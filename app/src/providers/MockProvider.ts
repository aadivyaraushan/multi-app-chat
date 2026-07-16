import AsyncStorage from '@react-native-async-storage/async-storage';
import { CANNED_REPLIES, seedService } from '../data/seed';
import { SERVICES } from '../services/capabilities';
import { Conversation, Message, ServiceId } from '../types';
import {
  ChatProvider,
  ConnectCredentials,
  ProviderEvent,
  ProviderListener,
  SendOptions,
} from './types';

// Seeded, offline provider used for demos and the e2e suite. It fakes the parts
// a real bridge would supply — delivery receipts, typing, contact replies — so
// every capability is exercisable without a homeserver. The set of connected
// services is persisted so a reload restores them (the MatrixProvider persists
// a real session for the same effect).

const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CONNECTED_KEY = 'mc.connectedServices';

let idCounter = 0;
const nextId = () => `msg-${Date.now()}-${idCounter++}`;

export class MockProvider implements ChatProvider {
  private listeners = new Set<ProviderListener>();
  private connected: ServiceId[] = [];
  private conversations: Conversation[] = [];
  private messages: Message[] = [];
  private activeConversationId: string | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  async start(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(CONNECTED_KEY);
      if (saved) {
        const list: ServiceId[] = JSON.parse(saved);
        for (const service of list) {
          if (!this.connected.includes(service)) this.connected.push(service);
          const { conversations, messages } = seedService(service);
          this.conversations.push(...conversations);
          this.messages.push(...messages);
        }
      }
    } catch {
      // ignore corrupt persisted state
    }
    this.emit({ type: 'ready' });
  }

  private persistConnected() {
    AsyncStorage.setItem(CONNECTED_KEY, JSON.stringify(this.connected)).catch(() => {});
  }

  stop(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.listeners.clear();
  }

  subscribe(listener: ProviderListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getConnectedServices(): ServiceId[] {
    return [...this.connected];
  }
  getConversations(): Conversation[] {
    return [...this.conversations];
  }
  getMessages(): Message[] {
    return [...this.messages];
  }

  async requestPairingCode(_service: ServiceId, _phone: string): Promise<string> {
    // A real bridge returns this from `login phone <number>`; here it is local.
    let s = '';
    for (let i = 0; i < 8; i++) {
      s += PAIRING_ALPHABET[Math.floor(Math.random() * PAIRING_ALPHABET.length)];
    }
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  }

  async connectService(service: ServiceId, _creds: ConnectCredentials): Promise<void> {
    if (!this.connected.includes(service)) this.connected.push(service);
    const { conversations, messages } = seedService(service);
    this.conversations = [
      ...this.conversations.filter((c) => c.service !== service),
      ...conversations,
    ];
    const seededIds = new Set(conversations.map((c) => c.id));
    this.messages = [
      ...this.messages.filter((m) => !seededIds.has(m.conversationId)),
      ...messages,
    ];
    this.persistConnected();
    this.emit({ type: 'connected', service });
    this.emit({ type: 'conversations' });
  }

  async disconnectService(service: ServiceId): Promise<void> {
    this.connected = this.connected.filter((s) => s !== service);
    const removed = new Set(
      this.conversations.filter((c) => c.service === service).map((c) => c.id),
    );
    this.conversations = this.conversations.filter((c) => c.service !== service);
    this.messages = this.messages.filter((m) => !removed.has(m.conversationId));
    this.persistConnected();
    this.emit({ type: 'disconnected', service });
    this.emit({ type: 'conversations' });
  }

  async sendMessage(conversationId: string, opts: SendOptions): Promise<void> {
    const convo = this.conversations.find((c) => c.id === conversationId);
    if (!convo) return;
    const caps = SERVICES[convo.service].capabilities;
    const msgId = nextId();
    const msg: Message = {
      id: msgId,
      conversationId,
      senderId: 'me',
      senderName: 'You',
      text: opts.text,
      imageUri: opts.imageUri,
      voiceNote: opts.voiceNote,
      timestamp: Date.now(),
      reactions: [],
      replyToId: opts.replyToId,
      threadParentId: opts.threadParentId,
      status: 'sending',
    };
    this.messages.push(msg);
    this.bumpActivity(conversationId);
    this.emit({ type: 'message', conversationId, message: msg, incoming: false });

    // Simulated delivery pipeline: sending -> sent -> delivered (-> read).
    this.schedule(() => this.patchMessage(msgId, { status: 'sent' }), 350);
    this.schedule(() => this.patchMessage(msgId, { status: 'delivered' }), 900);
    if (caps.readReceipts) this.schedule(() => this.patchMessage(msgId, { status: 'read' }), 2600);

    // Simulated contact reply (not for thread replies), with a typing hint.
    const replier = convo.participants[0];
    if (replier && !opts.threadParentId) {
      if (caps.typingIndicators) {
        this.schedule(() => this.setTyping(conversationId, replier.name), 1200);
      }
      this.schedule(() => {
        this.setTyping(conversationId, undefined);
        const reply: Message = {
          id: nextId(),
          conversationId,
          senderId: replier.id,
          senderName: replier.name,
          text: CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)],
          timestamp: Date.now(),
          reactions: [],
          status: 'read',
        };
        this.messages.push(reply);
        this.receiveIncoming(conversationId, reply);
      }, 3200);
    }
  }

  async toggleReaction(messageId: string, emoji: string): Promise<void> {
    const m = this.messages.find((x) => x.id === messageId);
    if (!m) return;
    const existing = m.reactions.find((r) => r.emoji === emoji);
    if (existing && existing.userIds.includes('me')) {
      m.reactions = m.reactions
        .map((r) => (r.emoji === emoji ? { ...r, userIds: r.userIds.filter((u) => u !== 'me') } : r))
        .filter((r) => r.userIds.length > 0);
    } else if (existing) {
      m.reactions = m.reactions.map((r) =>
        r.emoji === emoji ? { ...r, userIds: [...r.userIds, 'me'] } : r,
      );
    } else {
      m.reactions = [...m.reactions, { emoji, userIds: ['me'] }];
    }
    this.emit({ type: 'messages', conversationId: m.conversationId });
  }

  async markRead(conversationId: string): Promise<void> {
    const c = this.conversations.find((x) => x.id === conversationId);
    if (c && c.unreadCount !== 0) {
      c.unreadCount = 0;
      this.emit({ type: 'conversations' });
    }
  }

  async toggleMute(conversationId: string): Promise<void> {
    const c = this.conversations.find((x) => x.id === conversationId);
    if (!c) return;
    c.muted = !c.muted;
    this.emit({ type: 'conversations' });
  }

  setActiveConversation(conversationId: string | null): void {
    this.activeConversationId = conversationId;
  }

  // --- internals ---

  private receiveIncoming(conversationId: string, message: Message) {
    const c = this.conversations.find((x) => x.id === conversationId);
    if (c) {
      c.lastActivity = Date.now();
      if (this.activeConversationId !== conversationId) c.unreadCount += 1;
    }
    this.emit({ type: 'message', conversationId, message, incoming: true });
    this.emit({ type: 'conversations' });
  }

  private patchMessage(id: string, patch: Partial<Message>) {
    const m = this.messages.find((x) => x.id === id);
    if (!m) return;
    Object.assign(m, patch);
    this.emit({ type: 'messages', conversationId: m.conversationId });
  }

  private setTyping(conversationId: string, typing: string | undefined) {
    const c = this.conversations.find((x) => x.id === conversationId);
    if (!c) return;
    c.typing = typing;
    this.emit({ type: 'conversations' });
  }

  private bumpActivity(conversationId: string) {
    const c = this.conversations.find((x) => x.id === conversationId);
    if (c) c.lastActivity = Date.now();
  }

  private schedule(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, ms));
  }

  private emit(event: ProviderEvent) {
    this.listeners.forEach((l) => l(event));
  }
}
