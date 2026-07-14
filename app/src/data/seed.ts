import { Conversation, Message, Participant, ServiceId } from '../types';

// Seeded demo data behind the ChatProvider interface. The Matrix provider will
// replace this module; everything above the store is provider-agnostic.

const now = Date.now();
const min = 60_000;
const hr = 60 * min;

const p = (id: string, name: string, avatarColor: string): Participant => ({
  id,
  name,
  avatarColor,
  initials: name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase(),
});

export const CONTACTS = {
  priya: p('priya', 'Priya Sharma', '#7C5CBF'),
  marcus: p('marcus', 'Marcus Chen', '#2E8B8B'),
  mom: p('mom', 'Mom', '#C4636A'),
  familyGroup: p('family', 'Family', '#5B8C5A'),
  devteam: p('devteam', 'dev-team', '#611F69'),
  sarah: p('sarah', 'Sarah Kim', '#B8802E'),
  recruiter: p('recruiter', 'Jordan Ellis', '#0A66C2'),
  founder: p('founder', 'Alex Rivera', '#4A4A8A'),
  nadia: p('nadia', 'Nadia Osei', '#8A4A6B'),
  jake: p('jake', 'Jake Torres', '#3D7A52'),
};

interface SeedConvo {
  convo: Omit<Conversation, 'lastActivity' | 'unreadCount' | 'muted' | 'typing'>;
  unread?: number;
  messages: Array<{
    id: string;
    sender: Participant | 'me';
    text?: string;
    voice?: { durationSec: number };
    minutesAgo: number;
    reactions?: Array<{ emoji: string; by: string[] }>;
    replyToId?: string;
    threadParentId?: string;
  }>;
}

const SEEDS: Record<ServiceId, SeedConvo[]> = {
  whatsapp: [
    {
      convo: {
        id: 'wa-mom',
        service: 'whatsapp',
        title: 'Mom',
        isGroup: false,
        participants: [CONTACTS.mom],
      },
      unread: 2,
      messages: [
        { id: 'wa-mom-1', sender: 'me', text: 'Landed safely! The flight was fine.', minutesAgo: 190 },
        { id: 'wa-mom-2', sender: CONTACTS.mom, text: 'So glad to hear it. Did you eat anything?', minutesAgo: 185, reactions: [{ emoji: '❤️', by: ['me'] }] },
        { id: 'wa-mom-3', sender: CONTACTS.mom, text: 'Call me when you settle in tonight', minutesAgo: 12 },
        { id: 'wa-mom-4', sender: CONTACTS.mom, voice: { durationSec: 14 }, minutesAgo: 11 },
      ],
    },
    {
      convo: {
        id: 'wa-family',
        service: 'whatsapp',
        title: 'Family 🏡',
        isGroup: true,
        participants: [CONTACTS.mom, CONTACTS.jake, CONTACTS.nadia],
      },
      messages: [
        { id: 'wa-fam-1', sender: CONTACTS.jake, text: 'Who is bringing dessert on Sunday?', minutesAgo: 400 },
        { id: 'wa-fam-2', sender: 'me', text: 'I can pick up a cake 🎂', minutesAgo: 395, reactions: [{ emoji: '👍', by: ['jake', 'mom'] }] },
        { id: 'wa-fam-3', sender: CONTACTS.mom, text: 'Perfect, see everyone at 1pm', minutesAgo: 380 },
      ],
    },
  ],
  slack: [
    {
      convo: {
        id: 'sl-devteam',
        service: 'slack',
        title: '#dev-team',
        isGroup: true,
        isChannel: true,
        participants: [CONTACTS.sarah, CONTACTS.marcus],
      },
      unread: 3,
      messages: [
        { id: 'sl-dev-1', sender: CONTACTS.sarah, text: 'Deploy to staging is green ✅', minutesAgo: 95, reactions: [{ emoji: '🎉', by: ['marcus', 'me'] }] },
        { id: 'sl-dev-2', sender: CONTACTS.marcus, text: 'Anyone seen the flaky auth test on CI? Failing about 1 in 5 runs.', minutesAgo: 60 },
        { id: 'sl-dev-3', sender: CONTACTS.sarah, text: 'I think it races the token refresh — looking now', minutesAgo: 55, threadParentId: 'sl-dev-2' },
        { id: 'sl-dev-4', sender: 'me', text: 'There was a similar one last month, fixed by mocking the clock', minutesAgo: 50, threadParentId: 'sl-dev-2' },
        { id: 'sl-dev-5', sender: CONTACTS.sarah, text: 'Standup moved to 10:15 tomorrow', minutesAgo: 8 },
      ],
    },
    {
      convo: {
        id: 'sl-sarah',
        service: 'slack',
        title: 'Sarah Kim',
        isGroup: false,
        participants: [CONTACTS.sarah],
      },
      messages: [
        { id: 'sl-sarah-1', sender: CONTACTS.sarah, text: 'Do you have 15 min to pair on the review feedback?', minutesAgo: 150 },
        { id: 'sl-sarah-2', sender: 'me', text: 'Sure — after lunch?', minutesAgo: 145 },
        { id: 'sl-sarah-3', sender: CONTACTS.sarah, text: 'Works for me 👌', minutesAgo: 140 },
      ],
    },
  ],
  linkedin: [
    {
      convo: {
        id: 'li-recruiter',
        service: 'linkedin',
        title: 'Jordan Ellis',
        isGroup: false,
        participants: [CONTACTS.recruiter],
      },
      unread: 1,
      messages: [
        { id: 'li-rec-1', sender: CONTACTS.recruiter, text: 'Hi! I came across your profile and think you would be a great fit for a Staff Engineer role we are hiring for.', minutesAgo: 1500 },
        { id: 'li-rec-2', sender: 'me', text: 'Thanks for reaching out — happy to hear more. What is the team working on?', minutesAgo: 1400 },
        { id: 'li-rec-3', sender: CONTACTS.recruiter, text: 'Great! It is a platform team owning developer tooling. Would a 20 minute call this week work?', minutesAgo: 25 },
      ],
    },
  ],
  x: [
    {
      convo: {
        id: 'x-founder',
        service: 'x',
        title: 'Alex Rivera',
        isGroup: false,
        participants: [CONTACTS.founder],
      },
      messages: [
        { id: 'x-alex-1', sender: CONTACTS.founder, text: 'loved your thread on local-first apps', minutesAgo: 2000, reactions: [{ emoji: '🙏', by: ['me'] }] },
        { id: 'x-alex-2', sender: 'me', text: 'thanks! been meaning to write a follow-up on sync engines', minutesAgo: 1990 },
        { id: 'x-alex-3', sender: CONTACTS.founder, text: 'would read that. also — we should jam on this sometime', minutesAgo: 240 },
      ],
    },
  ],
  instagram: [
    {
      convo: {
        id: 'ig-nadia',
        service: 'instagram',
        title: 'Nadia Osei',
        isGroup: false,
        participants: [CONTACTS.nadia],
      },
      unread: 1,
      messages: [
        { id: 'ig-nadia-1', sender: CONTACTS.nadia, text: 'that trail looked unreal 😍 where is it?', minutesAgo: 320 },
        { id: 'ig-nadia-2', sender: 'me', text: 'Eagle Peak! about an hour north. happy to send the route', minutesAgo: 300 },
        { id: 'ig-nadia-3', sender: CONTACTS.nadia, text: 'yes please!! trying to go this weekend', minutesAgo: 45 },
      ],
    },
  ],
};

const FAKE_WAVEFORM = [0.3, 0.7, 0.5, 0.9, 0.4, 0.8, 0.6, 0.3, 0.7, 0.9, 0.5, 0.4, 0.8, 0.6, 0.4, 0.7, 0.3, 0.6, 0.8, 0.5];

export function seedService(service: ServiceId): { conversations: Conversation[]; messages: Message[] } {
  const conversations: Conversation[] = [];
  const messages: Message[] = [];
  for (const seed of SEEDS[service]) {
    const msgs: Message[] = seed.messages.map((m) => ({
      id: m.id,
      conversationId: seed.convo.id,
      senderId: m.sender === 'me' ? 'me' : m.sender.id,
      senderName: m.sender === 'me' ? 'You' : m.sender.name,
      text: m.text,
      voiceNote: m.voice ? { durationSec: m.voice.durationSec, waveform: FAKE_WAVEFORM } : undefined,
      timestamp: now - m.minutesAgo * min,
      reactions: (m.reactions ?? []).map((r) => ({ emoji: r.emoji, userIds: r.by })),
      replyToId: m.replyToId,
      threadParentId: m.threadParentId,
      status: 'read',
    }));
    messages.push(...msgs);
    const topLevel = msgs.filter((m) => !m.threadParentId);
    conversations.push({
      ...seed.convo,
      unreadCount: seed.unread ?? 0,
      muted: false,
      lastActivity: topLevel[topLevel.length - 1]?.timestamp ?? now - 24 * hr,
    });
  }
  return { conversations, messages };
}

// Canned replies for the simulated contact, so typing indicators, delivery
// status, and read receipts can be exercised without a live bridge.
export const CANNED_REPLIES = [
  'Sounds good!',
  'Ha, totally.',
  'Let me check and get back to you.',
  'Perfect timing — I was just thinking about that.',
  'Can we talk about this tomorrow?',
  '👀 interesting...',
];
