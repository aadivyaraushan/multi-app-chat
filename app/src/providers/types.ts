import { Conversation, Message, ServiceId, VoiceNote } from '../types';

// The contract every backend implements. The app's store talks only to this;
// swapping the seeded MockProvider for the live MatrixProvider changes nothing
// above this line.

export interface SendOptions {
  text?: string;
  imageUri?: string;
  voiceNote?: VoiceNote;
  replyToId?: string;
  threadParentId?: string;
}

export interface ConnectCredentials {
  // Slack
  token?: string;
  // LinkedIn / X / Instagram
  username?: string;
  password?: string;
  // WhatsApp completes via requestPairingCode(), so no creds here.
}

export type ProviderEvent =
  | { type: 'ready' }
  // Conversation list or metadata (unread, mute, typing, last activity) changed.
  | { type: 'conversations' }
  // The message set for one conversation changed (edit, reaction, status).
  | { type: 'messages'; conversationId: string }
  // A brand-new message landed. `incoming` is false for our own echoes.
  | { type: 'message'; conversationId: string; message: Message; incoming: boolean }
  | { type: 'connected'; service: ServiceId }
  | { type: 'disconnected'; service: ServiceId };

export type ProviderListener = (event: ProviderEvent) => void;

export interface ChatProvider {
  /** Begin syncing (restore a saved session if there is one). */
  start(): Promise<void>;
  /** Tear down timers / the sync loop. */
  stop(): void;
  /** Subscribe to live updates; returns an unsubscribe function. */
  subscribe(listener: ProviderListener): () => void;

  getConnectedServices(): ServiceId[];
  getConversations(): Conversation[];
  getMessages(): Message[];

  /**
   * WhatsApp: ask the bridge for an 8-character phone-pairing code. Resolves
   * with the code to show the user; the provider emits `connected` once the
   * bridge confirms the phone linked.
   */
  requestPairingCode(service: ServiceId, phone: string): Promise<string>;
  /** Slack/LinkedIn/X/Instagram: log the bridge in with credentials. */
  connectService(service: ServiceId, creds: ConnectCredentials): Promise<void>;
  disconnectService(service: ServiceId): Promise<void>;

  sendMessage(conversationId: string, opts: SendOptions): Promise<void>;
  toggleReaction(messageId: string, emoji: string): Promise<void>;
  markRead(conversationId: string): Promise<void>;
  toggleMute(conversationId: string): Promise<void>;

  /** Lets the provider suppress unread/notifications for the open chat. */
  setActiveConversation(conversationId: string | null): void;
}
