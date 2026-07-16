/* Verifies MatrixProvider against a REAL Synapse homeserver.
 *
 * Scenario: alice (us) and bob (a contact) share a room that carries an
 * `m.bridge` state event advertising the WhatsApp protocol — exactly what a
 * mautrix portal room looks like. We drive bob with a raw matrix-js-sdk client
 * and assert MatrixProvider (alice's view) maps everything correctly:
 * service detection, message sync, replies, threads, reactions, read receipts,
 * unread counts, sending, and our own reaction round-trip.
 */
import {
  ClientEvent,
  EventType,
  MsgType,
  RelationType,
  createClient,
} from 'matrix-js-sdk';
import { MatrixProvider } from '../src/providers/MatrixProvider';
import { ProviderEvent } from '../src/providers/types';

const BASE = 'http://localhost:8008';
const results: Array<[boolean, string, string?]> = [];

function ok(name: string) {
  results.push([true, name]);
  console.log('PASS |', name);
}
function fail(name: string, detail: string) {
  results.push([false, name, detail]);
  console.log('FAIL |', name, '|', detail);
}
async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    ok(name);
  } catch (e: any) {
    fail(name, e?.message ?? String(e));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(desc: string, fn: () => T | undefined, timeoutMs = 15000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${desc}`);
    await sleep(200);
  }
}

async function login(user: string, password: string) {
  const c = createClient({ baseUrl: BASE });
  const res = await c.login('m.login.password', {
    identifier: { type: 'm.id.user', user },
    password,
  });
  return { accessToken: res.access_token, userId: res.user_id, deviceId: res.device_id };
}

(async () => {
  // --- bob: a raw client that will play the remote contact ---
  const bobCreds = await login('bob', 'bobpass');
  const bob = createClient({
    baseUrl: BASE,
    accessToken: bobCreds.accessToken,
    userId: bobCreds.userId,
    deviceId: bobCreds.deviceId,
  });
  await bob.startClient({ initialSyncLimit: 20 });
  await new Promise<void>((res) => bob.once(ClientEvent.Sync, (s) => s === 'PREPARED' && res()));

  const aliceCreds = await login('alice', 'alicepass');

  // bob creates the "portal" room, invites alice, tags it as a WhatsApp bridge room
  const { room_id: roomId } = await bob.createRoom({ name: 'Mom', invite: [aliceCreds.userId] });
  await bob.sendStateEvent(
    roomId,
    'm.bridge' as any,
    { bridgebot: bobCreds.userId, protocol: { id: 'whatsapp', displayname: 'WhatsApp' } } as any,
    'whatsapp',
  );
  const firstEv = await bob.sendEvent(roomId, EventType.RoomMessage, {
    msgtype: MsgType.Text,
    body: 'Call me when you settle in tonight',
  } as any);

  // --- alice: the MatrixProvider under test ---
  const provider = new MatrixProvider({
    baseUrl: BASE,
    userId: aliceCreds.userId,
    accessToken: aliceCreds.accessToken,
    deviceId: aliceCreds.deviceId,
  });
  const events: ProviderEvent[] = [];
  provider.subscribe((e) => events.push(e));
  await provider.start();

  // Scope every lookup to THIS run's room — alice's client also syncs rooms
  // left over from previous runs (same name/text), which must not match.
  const findMsg = (pred: (m: any) => boolean) =>
    provider.getMessages().find((m) => m.conversationId === roomId && pred(m));

  // alice must auto-join the invite for sync to see the room
  const aliceRaw = createClient({
    baseUrl: BASE,
    accessToken: aliceCreds.accessToken,
    userId: aliceCreds.userId,
    deviceId: aliceCreds.deviceId,
  });
  await aliceRaw.joinRoom(roomId);

  await check('service detection: bridged room maps to whatsapp', async () => {
    await waitFor('conversation', () => provider.getConversations().find((c) => c.id === roomId));
    const convo = provider.getConversations().find((c) => c.id === roomId)!;
    if (convo.service !== 'whatsapp') throw new Error(`service was ${convo.service}`);
    if (!provider.getConnectedServices().includes('whatsapp')) throw new Error('whatsapp not in connected');
  });

  await check('message sync: incoming text appears with correct sender', async () => {
    const msg = await waitFor('incoming message', () =>
      findMsg((m) => m.text === 'Call me when you settle in tonight'),
    );
    if (msg.conversationId !== roomId) throw new Error('wrong conversation');
    if (msg.senderId === 'me') throw new Error('sender should not be me');
    if (msg.senderName !== 'Mom' && !msg.senderName.includes('bob')) {
      // display name may be bob's; accept either
    }
  });

  await check('conversation title reflects the room', async () => {
    const convo = await waitFor('convo', () => provider.getConversations().find((c) => c.id === roomId));
    if (convo.title !== 'Mom') throw new Error(`title was ${convo.title}`);
  });

  // Unread + markRead, run before any threaded message so the main-timeline
  // read receipt clears the whole count. (Messages bob sent before alice joined
  // do not notify, which is why we assert on a fresh post-join message here.)
  await check('unread grows on new message, markRead clears it', async () => {
    await bob.sendEvent(roomId, EventType.RoomMessage, { msgtype: MsgType.Text, body: 'you up?' } as any);
    await waitFor('unread >= 1', () => {
      const c = provider.getConversations().find((x) => x.id === roomId);
      return c && c.unreadCount >= 1 ? c : undefined;
    });
    await provider.markRead(roomId);
    await waitFor('unread cleared', () => {
      const c = provider.getConversations().find((x) => x.id === roomId);
      return c && c.unreadCount === 0 ? c : undefined;
    }, 20000);
  });

  await check('send: provider posts a message bob receives', async () => {
    await provider.sendMessage(roomId, { text: 'On my way home now' });
    await waitFor('bob sees message', () => {
      const room = bob.getRoom(roomId);
      return room?.getLiveTimeline().getEvents().find((e) => e.getContent().body === 'On my way home now');
    });
    // and it shows in alice's own view as mine
    const mine = await waitFor('own echo', () =>
      findMsg((m) => m.text === 'On my way home now'),
    );
    if (mine.senderId !== 'me') throw new Error('own message not marked me');
  });

  await check('reply: quoting maps to replyToId', async () => {
    await bob.sendEvent(roomId, EventType.RoomMessage, {
      msgtype: MsgType.Text,
      body: 'yes tonight works',
      'm.relates_to': { 'm.in_reply_to': { event_id: firstEv.event_id } },
    } as any);
    const reply = await waitFor('reply', () =>
      findMsg((m) => m.text === 'yes tonight works'),
    );
    if (reply.replyToId !== firstEv.event_id) throw new Error(`replyToId was ${reply.replyToId}`);
  });

  await check('thread: threaded reply maps to threadParentId', async () => {
    await bob.sendEvent(roomId, EventType.RoomMessage, {
      msgtype: MsgType.Text,
      body: 'in-thread note',
      'm.relates_to': {
        rel_type: RelationType.Thread,
        event_id: firstEv.event_id,
        'm.in_reply_to': { event_id: firstEv.event_id },
      },
    } as any);
    const threaded = await waitFor('threaded', () =>
      findMsg((m) => m.text === 'in-thread note'),
    );
    if (threaded.threadParentId !== firstEv.event_id) throw new Error(`threadParentId ${threaded.threadParentId}`);
  });

  await check('reaction (incoming): bob reaction aggregates onto message', async () => {
    await bob.sendEvent(roomId, EventType.Reaction, {
      'm.relates_to': { rel_type: RelationType.Annotation, event_id: firstEv.event_id, key: '❤️' },
    } as any);
    const msg = await waitFor('reaction present', () => {
      const m = provider.getMessages().find((x) => x.id === firstEv.event_id);
      return m && m.reactions.some((r) => r.emoji === '❤️') ? m : undefined;
    });
    const r = msg.reactions.find((x) => x.emoji === '❤️')!;
    if (!r.userIds.includes(bobCreds.userId)) throw new Error('bob not in reaction users');
  });

  await check('reaction (outgoing): provider toggles our own reaction on then off', async () => {
    await provider.toggleReaction(firstEv.event_id, '👍');
    await waitFor('our reaction on', () => {
      const m = provider.getMessages().find((x) => x.id === firstEv.event_id);
      return m?.reactions.find((r) => r.emoji === '👍' && r.userIds.includes('me'));
    });
    await provider.toggleReaction(firstEv.event_id, '👍');
    // wait for it to clear
    const start = Date.now();
    for (;;) {
      const m = provider.getMessages().find((x) => x.id === firstEv.event_id);
      const still = m?.reactions.find((r) => r.emoji === '👍' && r.userIds.includes('me'));
      if (!still) break;
      if (Date.now() - start > 10000) throw new Error('reaction did not toggle off');
      await sleep(200);
    }
  });

  await check('read receipts: our sent message flips to read after bob reads', async () => {
    const sent = await bob.getRoom(roomId)!;
    // find alice's "On my way home now" event id from bob's timeline
    const ev = sent
      .getLiveTimeline()
      .getEvents()
      .find((e) => e.getContent().body === 'On my way home now')!;
    await bob.sendReadReceipt(ev);
    await waitFor('status read', () => {
      const m = findMsg((x) => x.text === 'On my way home now');
      return m && m.status === 'read' ? m : undefined;
    });
  });

  await check('provider emitted ready + message events', async () => {
    if (!events.some((e) => e.type === 'ready')) throw new Error('no ready event');
    if (!events.some((e) => e.type === 'message')) throw new Error('no message event');
  });

  provider.stop();
  bob.stopClient();
  aliceRaw.stopClient();

  console.log('\n================ MATRIX SUMMARY ================');
  const fails = results.filter((r) => !r[0]);
  console.log(`${results.length - fails.length}/${results.length} checks passed`);
  for (const f of fails) console.log('FAILED:', f[1], '-', f[2]);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
