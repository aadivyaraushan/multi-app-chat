import { ServiceId, ServiceMeta } from '../types';

// The capability flags below are what power the adaptive UI: components render
// from these, so there is exactly one chat screen and no per-service forks.
// When the Matrix provider lands, these stay the single source of truth for
// which controls a conversation shows.
export const SERVICES: Record<ServiceId, ServiceMeta> = {
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp',
    shortName: 'WhatsApp',
    brandColor: '#25D366',
    badgeGlyph: 'W',
    connectKind: 'pairing',
    connectHint: 'Enter an 8-character code on your phone — no QR scan needed.',
    capabilities: {
      reactions: true,
      replies: true,
      threads: false,
      voiceNotes: true,
      typingIndicators: true,
      readReceipts: true,
      media: true,
    },
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    shortName: 'Slack',
    brandColor: '#611F69',
    badgeGlyph: 'S',
    connectKind: 'token',
    connectHint: 'Sign in with your Slack workspace token.',
    capabilities: {
      reactions: true,
      replies: false, // Slack replies happen in threads
      threads: true,
      voiceNotes: false,
      typingIndicators: true,
      readReceipts: false,
      media: true,
    },
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    shortName: 'LinkedIn',
    brandColor: '#0A66C2',
    badgeGlyph: 'in',
    connectKind: 'credentials',
    connectHint: 'Sign in with your LinkedIn account. Uses an unofficial API.',
    capabilities: {
      reactions: true,
      replies: false,
      threads: false,
      voiceNotes: false,
      typingIndicators: true,
      readReceipts: true,
      media: true,
    },
  },
  x: {
    id: 'x',
    name: 'X (Twitter)',
    shortName: 'X',
    brandColor: '#111111',
    badgeGlyph: 'X',
    connectKind: 'credentials',
    connectHint: 'Sign in with your X account. Uses an unofficial API.',
    capabilities: {
      reactions: true,
      replies: true,
      threads: false,
      voiceNotes: false,
      typingIndicators: false,
      readReceipts: true,
      media: true,
    },
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    shortName: 'IG',
    brandColor: '#E1306C',
    badgeGlyph: 'IG',
    connectKind: 'credentials',
    connectHint: 'Sign in with your Instagram account. Uses an unofficial API.',
    capabilities: {
      reactions: true,
      replies: true,
      threads: false,
      voiceNotes: false,
      typingIndicators: true,
      readReceipts: true,
      media: true,
    },
  },
};

export const SERVICE_ORDER: ServiceId[] = ['whatsapp', 'slack', 'linkedin', 'x', 'instagram'];
