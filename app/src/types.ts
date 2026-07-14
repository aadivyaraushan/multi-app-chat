export type ServiceId = 'whatsapp' | 'slack' | 'linkedin' | 'x' | 'instagram';

export interface ServiceCapabilities {
  reactions: boolean;
  replies: boolean;
  threads: boolean;
  voiceNotes: boolean;
  typingIndicators: boolean;
  readReceipts: boolean;
  media: boolean;
}

export interface ServiceMeta {
  id: ServiceId;
  name: string;
  shortName: string;
  brandColor: string;
  badgeGlyph: string;
  capabilities: ServiceCapabilities;
  connectKind: 'pairing' | 'token' | 'credentials';
  connectHint: string;
}

export interface Reaction {
  emoji: string;
  userIds: string[]; // 'me' for self
}

export interface VoiceNote {
  durationSec: number;
  waveform: number[]; // 0..1 amplitudes
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string; // 'me' or contact id
  senderName: string;
  text?: string;
  imageUri?: string;
  voiceNote?: VoiceNote;
  timestamp: number;
  reactions: Reaction[];
  replyToId?: string;
  threadParentId?: string; // Slack: message this belongs to as a thread reply
  status: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface Participant {
  id: string;
  name: string;
  avatarColor: string;
  initials: string;
}

export interface Conversation {
  id: string;
  service: ServiceId;
  title: string;
  isGroup: boolean;
  isChannel?: boolean; // Slack channels
  participants: Participant[];
  unreadCount: number;
  muted: boolean;
  typing?: string; // name of participant currently typing
  lastActivity: number;
}

export type AppearanceMode = 'light' | 'dark' | 'system';

export interface NotificationPrefs {
  master: boolean;
  perService: Record<ServiceId, boolean>;
  showPreviews: boolean;
}
