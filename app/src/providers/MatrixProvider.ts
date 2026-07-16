import {
  ClientEvent,
  Direction,
  EventType,
  IContent,
  MatrixClient,
  MatrixEvent,
  MsgType,
  NotificationCountType,
  RelationType,
  Room,
  RoomEvent,
  RoomMemberEvent,
  createClient,
} from 'matrix-js-sdk';
import { SERVICE_ORDER, SERVICES } from '../services/capabilities';
import { Conversation, Message, Participant, Reaction, ServiceId } from '../types';
import {
  ChatProvider,
  ConnectCredentials,
  ProviderEvent,
  ProviderListener,
  SendOptions,
} from './types';

// Minimal persistence surface so this class runs both in the app (backed by
// AsyncStorage) and in Node verification (in-memory) without pulling in RN.
export interface SessionStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const memoryStore = (): SessionStore => {
  const m = new Map<string, string>();
  return {
    getItem: async (k) => m.get(k) ?? null,
    setItem: async (k, v) => void m.set(k, v),
    removeItem: async (k) => void m.delete(k),
  };
};

export interface MatrixProviderConfig {
  baseUrl: string;
  userId?: string;
  accessToken?: string;
  password?: string;
  deviceId?: string;
  session?: SessionStore;
  /**
   * Bridge bot user IDs (localpart resolved against the homeserver). Defaults
   * match the mautrix bridges in ../../server. Used for the login flows.
   */
  bridgeBots?: Partial<Record<ServiceId, string>>;
}

const SESSION_KEY = 'mc.matrixSession';

// mautrix advertises the network via an `m.bridge` / `uk.half-shot.bridge`
// state event whose content.protocol.id we map to our ServiceId.
const PROTOCOL_TO_SERVICE: Array<[RegExp, ServiceId]> = [
  [/whatsapp/i, 'whatsapp'],
  [/slack/i, 'slack'],
  [/linkedin/i, 'linkedin'],
  [/twitter|(^|[^a-z])x([^a-z]|$)/i, 'x'],
  [/instagram|meta|facebook|messenger/i, 'instagram'],
];

const BRIDGE_STATE_TYPES = ['m.bridge', 'uk.half-shot.bridge'];
const VOICE_FLAG = 'org.matrix.msc3245.voice';

export class MatrixProvider implements ChatProvider {
  private client: MatrixClient | null = null;
  private listeners = new Set<ProviderListener>();
  private session: SessionStore;
  private typingByRoom = new Map<string, string | undefined>();
  private started = false;

  constructor(private config: MatrixProviderConfig) {
    this.session = config.session ?? memoryStore();
  }

  // --- lifecycle ---

  async start(): Promise<void> {
    const restored = await this.restoreSession();
    const creds =
      restored ??
      (this.config.accessToken && this.config.userId
        ? {
            accessToken: this.config.accessToken,
            userId: this.config.userId,
            deviceId: this.config.deviceId,
          }
        : this.config.password && this.config.userId
          ? await this.passwordLogin(this.config.userId, this.config.password)
          : null);

    if (!creds) {
      // No session yet; the app can still render (empty) and connect later.
      this.emit({ type: 'ready' });
      return;
    }

    this.client = createClient({
      baseUrl: this.config.baseUrl,
      accessToken: creds.accessToken,
      userId: creds.userId,
      deviceId: creds.deviceId,
    });
    this.wireEvents();
    await this.client.startClient({ initialSyncLimit: 30 });
    this.started = true;
  }

  stop(): void {
    this.client?.stopClient();
    this.listeners.clear();
  }

  subscribe(listener: ProviderListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- login ---

  private async passwordLogin(userId: string, password: string) {
    const tmp = createClient({ baseUrl: this.config.baseUrl });
    const res = await tmp.login('m.login.password', {
      identifier: { type: 'm.id.user', user: userId },
      password,
    });
    const creds = {
      accessToken: res.access_token,
      userId: res.user_id,
      deviceId: res.device_id,
    };
    await this.session.setItem(SESSION_KEY, JSON.stringify(creds));
    return creds;
  }

  private async restoreSession() {
    try {
      const raw = await this.session.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s.accessToken && s.userId) return s;
    } catch {
      /* ignore */
    }
    return null;
  }

  // --- snapshots ---

  getConnectedServices(): ServiceId[] {
    if (!this.client) return [];
    const found = new Set<ServiceId>();
    for (const room of this.client.getRooms()) {
      const s = this.serviceForRoom(room);
      if (s) found.add(s);
    }
    return SERVICE_ORDER.filter((s) => found.has(s));
  }

  getConversations(): Conversation[] {
    if (!this.client) return [];
    const me = this.client.getUserId();
    const out: Conversation[] = [];
    for (const room of this.client.getRooms()) {
      const service = this.serviceForRoom(room);
      if (!service) continue;
      const members = room
        .getJoinedMembers()
        .filter((m) => m.userId !== me)
        .map<Participant>((m) => ({
          id: m.userId,
          name: m.name,
          avatarColor: colorFor(m.userId),
          initials: initials(m.name),
        }));
      const lastEvent = lastMessageEvent(room);
      out.push({
        id: room.roomId,
        service,
        title: room.name || members[0]?.name || 'Conversation',
        isGroup: members.length > 1,
        isChannel: service === 'slack' && members.length > 1,
        participants: members,
        unreadCount: room.getUnreadNotificationCount(NotificationCountType.Total) ?? 0,
        muted: this.isMuted(room.roomId),
        typing: this.typingByRoom.get(room.roomId),
        lastActivity: lastEvent ? lastEvent.getTs() : room.getLastActiveTimestamp(),
      });
    }
    return out.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  getMessages(): Message[] {
    if (!this.client) return [];
    const out: Message[] = [];
    for (const room of this.client.getRooms()) {
      if (!this.serviceForRoom(room)) continue;
      out.push(...this.messagesForRoom(room));
    }
    return out;
  }

  private messagesForRoom(room: Room): Message[] {
    const me = this.client!.getUserId();
    const events = room.getLiveTimeline().getEvents();

    // First pass: aggregate reactions by target event id.
    const reactionsByTarget = new Map<string, Map<string, Set<string>>>();
    for (const ev of events) {
      if (ev.getType() !== EventType.Reaction) continue;
      const rel = ev.getContent()['m.relates_to'];
      if (!rel || rel.rel_type !== RelationType.Annotation || !rel.event_id || !rel.key) continue;
      if (!reactionsByTarget.has(rel.event_id)) reactionsByTarget.set(rel.event_id, new Map());
      const byKey = reactionsByTarget.get(rel.event_id)!;
      if (!byKey.has(rel.key)) byKey.set(rel.key, new Set());
      byKey.get(rel.key)!.add(ev.getSender() === me ? 'me' : ev.getSender()!);
    }

    const messages: Message[] = [];
    for (const ev of events) {
      if (ev.getType() !== EventType.RoomMessage) continue;
      if (ev.isRedacted()) continue;
      const msg = this.mapMessage(room, ev, reactionsByTarget.get(ev.getId()!));
      if (msg) messages.push(msg);
    }
    return messages;
  }

  private mapMessage(
    room: Room,
    ev: MatrixEvent,
    reactionKeys?: Map<string, Set<string>>,
  ): Message | null {
    const me = this.client!.getUserId();
    const content = ev.getContent();
    const sender = ev.getSender()!;
    const mine = sender === me;

    const rel = content['m.relates_to'] ?? {};
    const isThread = rel.rel_type === RelationType.Thread;
    const threadParentId = isThread ? rel.event_id : undefined;
    const replyToId = rel['m.in_reply_to']?.event_id ?? (isThread ? undefined : undefined);

    const reactions: Reaction[] = [];
    if (reactionKeys) {
      for (const [emoji, users] of reactionKeys) {
        reactions.push({ emoji, userIds: [...users] });
      }
    }

    const base = {
      id: ev.getId()!,
      conversationId: room.roomId,
      senderId: mine ? 'me' : sender,
      senderName: mine ? 'You' : room.getMember(sender)?.name ?? sender,
      timestamp: ev.getTs(),
      reactions,
      replyToId,
      threadParentId,
      status: this.statusFor(room, ev, mine),
    };

    switch (content.msgtype) {
      case MsgType.Text:
      case MsgType.Notice:
      case MsgType.Emote:
        return { ...base, text: content.body };
      case MsgType.Image:
        return { ...base, imageUri: this.mediaUrl(content) ?? undefined, text: undefined };
      case MsgType.Audio:
        if (content[VOICE_FLAG] !== undefined || content['org.matrix.msc1767.audio']) {
          const durationMs =
            content['org.matrix.msc1767.audio']?.duration ?? content.info?.duration ?? 0;
          return {
            ...base,
            voiceNote: { durationSec: Math.round(durationMs / 1000) || 1, waveform: flatWaveform() },
          };
        }
        return { ...base, text: content.body };
      default:
        return content.body ? { ...base, text: content.body } : null;
    }
  }

  private statusFor(room: Room, ev: MatrixEvent, mine: boolean): Message['status'] {
    if (!mine) return 'read';
    const status = ev.status; // local echo status, null once on server
    if (status === 'sending' || status === 'queued') return 'sending';
    if (status === 'not_sent') return 'sending';
    // On the server: read if any other joined member has read up to here.
    const me = this.client!.getUserId();
    const others = room.getJoinedMembers().filter((m) => m.userId !== me);
    for (const m of others) {
      if (room.hasUserReadEvent(m.userId, ev.getId()!)) return 'read';
    }
    return 'sent';
  }

  private mediaUrl(content: IContent): string | null {
    const mxc = content.url ?? content.file?.url;
    if (!mxc || !this.client) return null;
    return this.client.mxcUrlToHttp(mxc) ?? null;
  }

  // --- service detection ---

  private serviceForRoom(room: Room): ServiceId | null {
    for (const type of BRIDGE_STATE_TYPES) {
      const events = room.currentState.getStateEvents(type);
      for (const ev of events) {
        const protocolId =
          ev.getContent()?.protocol?.id ?? ev.getContent()?.network?.id ?? '';
        for (const [re, service] of PROTOCOL_TO_SERVICE) {
          if (re.test(String(protocolId))) return service;
        }
      }
    }
    return null;
  }

  private isMuted(roomId: string): boolean {
    try {
      const rule = this.client?.getRoomPushRule?.('global', roomId);
      if (!rule) return false;
      const actions = rule.actions ?? [];
      return actions.includes('dont_notify' as never) || actions.length === 0;
    } catch {
      return false;
    }
  }

  // --- actions ---

  async requestPairingCode(service: ServiceId, phone: string): Promise<string> {
    // WhatsApp: DM the bridge bot `login phone <number>`; it replies with the
    // 8-character code to enter on the handset.
    const reply = await this.bridgeCommand(service, `login phone ${phone}`, /([A-Z0-9]{4}-?[A-Z0-9]{4})/);
    return reply.replace(/([A-Z0-9]{4})-?([A-Z0-9]{4})/, '$1-$2');
  }

  async connectService(service: ServiceId, creds: ConnectCredentials): Promise<void> {
    if (service === 'slack' && creds.token) {
      await this.bridgeCommand(service, `login token ${creds.token}`);
    } else if (creds.username && creds.password) {
      await this.bridgeCommand(service, `login ${creds.username} ${creds.password}`);
    }
    // The bridge provisions portal rooms asynchronously; sync events will emit
    // `connected` once a bridged room appears.
  }

  async disconnectService(service: ServiceId): Promise<void> {
    await this.bridgeCommand(service, 'logout');
    this.emit({ type: 'disconnected', service });
    this.emit({ type: 'conversations' });
  }

  async sendMessage(conversationId: string, opts: SendOptions): Promise<void> {
    if (!this.client) return;
    const content: IContent = { msgtype: MsgType.Text, body: opts.text ?? '' };
    if (opts.replyToId) {
      content['m.relates_to'] = { 'm.in_reply_to': { event_id: opts.replyToId } };
    }
    if (opts.threadParentId) {
      content['m.relates_to'] = {
        rel_type: RelationType.Thread,
        event_id: opts.threadParentId,
        is_falling_back: true,
        'm.in_reply_to': { event_id: opts.threadParentId },
      };
    }
    // matrix-js-sdk's per-type content unions are stricter than our runtime
    // shape; the cast is confined to this glue boundary.
    await this.client.sendEvent(conversationId, EventType.RoomMessage, content as never);
  }

  async toggleReaction(messageId: string, emoji: string): Promise<void> {
    if (!this.client) return;
    const room = this.roomForEvent(messageId);
    if (!room) return;
    const me = this.client.getUserId();
    const mine = room
      .getLiveTimeline()
      .getEvents()
      .find(
        (ev) =>
          ev.getType() === EventType.Reaction &&
          ev.getSender() === me &&
          ev.getContent()['m.relates_to']?.event_id === messageId &&
          ev.getContent()['m.relates_to']?.key === emoji,
      );
    if (mine) {
      await this.client.redactEvent(room.roomId, mine.getId()!);
    } else {
      await this.client.sendEvent(room.roomId, EventType.Reaction, {
        'm.relates_to': { rel_type: RelationType.Annotation, event_id: messageId, key: emoji },
      });
    }
  }

  async markRead(conversationId: string): Promise<void> {
    if (!this.client) return;
    const room = this.client.getRoom(conversationId);
    const last = room && lastMessageEvent(room);
    if (room && last) await this.client.sendReadReceipt(last);
  }

  async toggleMute(conversationId: string): Promise<void> {
    if (!this.client) return;
    const muted = this.isMuted(conversationId);
    try {
      if (muted) {
        await this.client.deletePushRule('global', 'room' as never, conversationId);
      } else {
        await this.client.addPushRule('global', 'room' as never, conversationId, {
          actions: ['dont_notify' as never],
        });
      }
    } catch {
      /* best effort; push-rule shape varies by server */
    }
    this.emit({ type: 'conversations' });
  }

  setActiveConversation(conversationId: string | null): void {
    if (conversationId) this.markRead(conversationId).catch(() => {});
  }

  // --- bridge helpers ---

  private botUserId(service: ServiceId): string {
    const configured = this.config.bridgeBots?.[service];
    if (configured) return configured;
    const domain = this.config.baseUrl.replace(/^https?:\/\//, '').replace(/:\d+.*$/, '');
    const localpart: Record<ServiceId, string> = {
      whatsapp: 'whatsappbot',
      slack: 'slackbot',
      linkedin: 'linkedinbot',
      x: 'twitterbot',
      instagram: 'instagrambot',
    };
    return `@${localpart[service]}:${domain}`;
  }

  private async bridgeCommand(
    service: ServiceId,
    command: string,
    expect?: RegExp,
    timeoutMs = 20000,
  ): Promise<string> {
    if (!this.client) throw new Error('not started');
    const bot = this.botUserId(service);
    const roomId = await this.ensureDm(bot);
    const replyPromise = expect
      ? this.waitForBotReply(roomId, bot, expect, timeoutMs)
      : Promise.resolve('');
    await this.client.sendEvent(roomId, EventType.RoomMessage, {
      msgtype: MsgType.Text,
      body: command,
    });
    return replyPromise;
  }

  private async ensureDm(userId: string): Promise<string> {
    const existing = this.client!.getRooms().find((r) => {
      const members = r.getJoinedMembers().map((m) => m.userId);
      return members.length <= 2 && members.includes(userId);
    });
    if (existing) return existing.roomId;
    const res = await this.client!.createRoom({ is_direct: true, invite: [userId] });
    return res.room_id;
  }

  private waitForBotReply(
    roomId: string,
    bot: string,
    expect: RegExp,
    timeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = this.client!;
      const timer = setTimeout(() => {
        client.removeListener(RoomEvent.Timeline, handler);
        reject(new Error('bridge reply timed out'));
      }, timeoutMs);
      const handler = (ev: MatrixEvent) => {
        if (ev.getRoomId() !== roomId || ev.getSender() !== bot) return;
        if (ev.getType() !== EventType.RoomMessage) return;
        const body = ev.getContent().body ?? '';
        const m = expect.exec(body);
        if (m) {
          clearTimeout(timer);
          client.removeListener(RoomEvent.Timeline, handler);
          resolve(m[1] ?? body);
        }
      };
      client.on(RoomEvent.Timeline, handler);
    });
  }

  private roomForEvent(eventId: string): Room | undefined {
    return this.client
      ?.getRooms()
      .find((r) => r.getLiveTimeline().getEvents().some((ev) => ev.getId() === eventId));
  }

  // --- event wiring ---

  private wireEvents() {
    const client = this.client!;
    let readyEmitted = false;

    client.once(ClientEvent.Sync, (state: string) => {
      if (state === 'PREPARED' && !readyEmitted) {
        readyEmitted = true;
        this.emit({ type: 'ready' });
        this.emit({ type: 'conversations' });
      }
    });

    client.on(RoomEvent.Timeline, (ev: MatrixEvent, room: Room | undefined, toStart?: boolean) => {
      if (toStart || !room) return;
      if (!this.serviceForRoom(room)) return;
      const type = ev.getType();
      if (type === EventType.RoomMessage) {
        const me = client.getUserId();
        const mapped = this.mapMessage(room, ev);
        if (mapped) {
          this.emit({
            type: 'message',
            conversationId: room.roomId,
            message: mapped,
            incoming: ev.getSender() !== me,
          });
        }
        this.emit({ type: 'conversations' });
      } else if (type === EventType.Reaction || type === EventType.RoomRedaction) {
        this.emit({ type: 'messages', conversationId: room.roomId });
      }
    });

    client.on(RoomEvent.Receipt, (_ev: MatrixEvent, room: Room) => {
      if (this.serviceForRoom(room)) {
        this.emit({ type: 'messages', conversationId: room.roomId });
        this.emit({ type: 'conversations' });
      }
    });

    client.on(RoomMemberEvent.Typing, (_ev: MatrixEvent, member) => {
      const room = client.getRoom(member.roomId);
      if (!room || !this.serviceForRoom(room)) return;
      const me = client.getUserId();
      const typer = room
        .getJoinedMembers()
        .find((m) => m.userId !== me && room.getMember(m.userId)?.typing);
      this.typingByRoom.set(member.roomId, typer?.name);
      this.emit({ type: 'conversations' });
    });
  }

  private emit(event: ProviderEvent) {
    this.listeners.forEach((l) => l(event));
  }
}

// --- small helpers ---

function lastMessageEvent(room: Room): MatrixEvent | undefined {
  const events = room.getLiveTimeline().getEvents();
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].getType() === EventType.RoomMessage && !events[i].isRedacted()) return events[i];
  }
  return undefined;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = ['#7C5CBF', '#2E8B8B', '#C4636A', '#5B8C5A', '#B8802E', '#0A66C2', '#8A4A6B'];
function colorFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function flatWaveform(): number[] {
  return Array.from({ length: 20 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 1.3)));
}

// Keep the capabilities import referenced for future capability gating.
void SERVICES;
void Direction;
