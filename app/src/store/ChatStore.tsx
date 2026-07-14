import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CANNED_REPLIES, seedService } from '../data/seed';
import { SERVICES } from '../services/capabilities';
import {
  AppearanceMode,
  Conversation,
  Message,
  NotificationPrefs,
  ServiceId,
  VoiceNote,
} from '../types';

// Store backed by the seeded provider. The public API of this store is the
// contract the Matrix-backed provider will fulfil; screens never talk to a
// service directly.

const STORAGE_KEYS = {
  connected: 'mc.connectedServices',
  prefs: 'mc.notificationPrefs',
  appearance: 'mc.appearance',
};

export interface Banner {
  id: string;
  conversationId: string;
  service: ServiceId;
  title: string;
  preview: string;
}

interface SendOptions {
  text?: string;
  imageUri?: string;
  voiceNote?: VoiceNote;
  replyToId?: string;
  threadParentId?: string;
}

interface ChatStore {
  hydrated: boolean;
  connectedServices: ServiceId[];
  conversations: Conversation[];
  messages: Message[];
  notificationPrefs: NotificationPrefs;
  appearance: AppearanceMode;
  banner: Banner | null;
  activeConversationId: string | null;

  connectService: (s: ServiceId) => void;
  disconnectService: (s: ServiceId) => void;
  sendMessage: (conversationId: string, opts: SendOptions) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  markRead: (conversationId: string) => void;
  toggleMute: (conversationId: string) => void;
  setNotificationPrefs: (p: NotificationPrefs) => void;
  setAppearance: (m: AppearanceMode) => void;
  setActiveConversation: (id: string | null) => void;
  dismissBanner: () => void;
}

const Ctx = createContext<ChatStore | null>(null);

const DEFAULT_PREFS: NotificationPrefs = {
  master: true,
  perService: { whatsapp: true, slack: true, linkedin: true, x: true, instagram: true },
  showPreviews: true,
};

let idCounter = 0;
const nextId = () => `msg-${Date.now()}-${idCounter++}`;

export function ChatStoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [connectedServices, setConnected] = useState<ServiceId[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notificationPrefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [appearance, setAppearanceState] = useState<AppearanceMode>('system');
  const [banner, setBanner] = useState<Banner | null>(null);
  const activeConversationRef = useRef<string | null>(null);
  const [activeConversationId, setActiveId] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);
  const prefsRef = useRef<NotificationPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    prefsRef.current = notificationPrefs;
  }, [notificationPrefs]);

  useEffect(() => {
    (async () => {
      try {
        const [connected, prefs, app] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.connected),
          AsyncStorage.getItem(STORAGE_KEYS.prefs),
          AsyncStorage.getItem(STORAGE_KEYS.appearance),
        ]);
        if (prefs) setPrefs(JSON.parse(prefs));
        if (app) setAppearanceState(JSON.parse(app));
        if (connected) {
          const list: ServiceId[] = JSON.parse(connected);
          setConnected(list);
          for (const s of list) loadService(s);
        }
      } finally {
        setHydrated(true);
      }
    })();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadService = (s: ServiceId) => {
    const { conversations: cs, messages: ms } = seedService(s);
    setConversations((prev) => [...prev.filter((c) => c.service !== s), ...cs]);
    setMessages((prev) => [...prev.filter((m) => !cs.some((c) => c.id === m.conversationId)), ...ms]);
  };

  const persistConnected = (list: ServiceId[]) => {
    AsyncStorage.setItem(STORAGE_KEYS.connected, JSON.stringify(list)).catch(() => {});
  };

  const connectService = useCallback((s: ServiceId) => {
    setConnected((prev) => {
      if (prev.includes(s)) return prev;
      const next = [...prev, s];
      persistConnected(next);
      return next;
    });
    loadService(s);
  }, []);

  const disconnectService = useCallback((s: ServiceId) => {
    setConnected((prev) => {
      const next = prev.filter((x) => x !== s);
      persistConnected(next);
      return next;
    });
    const removedIds = new Set(
      conversationsRef.current.filter((c) => c.service === s).map((c) => c.id),
    );
    setConversations((prev) => prev.filter((c) => c.service !== s));
    setMessages((prev) => prev.filter((m) => !removedIds.has(m.conversationId)));
  }, []);

  const schedule = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const updateMessage = (id: string, patch: Partial<Message>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const touchConversation = (conversationId: string, patch: Partial<Conversation> = {}) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, ...patch, lastActivity: Date.now() } : c)),
    );
  };

  const sendMessage = useCallback((conversationId: string, opts: SendOptions) => {
    const convo = conversationsRef.current.find((c) => c.id === conversationId);
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
    setMessages((prev) => [...prev, msg]);
    touchConversation(conversationId);

    // Simulated delivery pipeline: sending -> sent -> delivered (-> read where supported)
    schedule(() => updateMessage(msgId, { status: 'sent' }), 350);
    schedule(() => updateMessage(msgId, { status: 'delivered' }), 900);
    if (caps.readReceipts) schedule(() => updateMessage(msgId, { status: 'read' }), 2600);

    // Simulated contact reply, with a typing indicator where the service has one.
    const replier = convo.participants[0];
    if (replier && !opts.threadParentId) {
      if (caps.typingIndicators) {
        schedule(() => touchConversationTyping(conversationId, replier.name), 1200);
      }
      schedule(() => {
        touchConversationTyping(conversationId, undefined);
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
        setMessages((prev) => [...prev, reply]);
        const viewing = activeConversationRef.current === conversationId;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? { ...c, lastActivity: Date.now(), unreadCount: viewing ? 0 : c.unreadCount + 1 }
              : c,
          ),
        );
        maybeBanner(conversationId, convo.service, convo.title, reply.text ?? 'New message');
      }, 3200);
    }
  }, []);

  const touchConversationTyping = (conversationId: string, typing: string | undefined) => {
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, typing } : c)));
  };

  const maybeBanner = (
    conversationId: string,
    service: ServiceId,
    title: string,
    preview: string,
  ) => {
    const prefs = prefsRef.current;
    const convo = conversationsRef.current.find((c) => c.id === conversationId);
    const viewing = activeConversationRef.current === conversationId;
    if (prefs.master && prefs.perService[service] && convo && !convo.muted && !viewing) {
      setBanner({
        id: nextId(),
        conversationId,
        service,
        title,
        preview: prefs.showPreviews ? preview : 'New message',
      });
    }
  };

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const existing = m.reactions.find((r) => r.emoji === emoji);
        let reactions;
        if (existing && existing.userIds.includes('me')) {
          reactions = m.reactions
            .map((r) =>
              r.emoji === emoji ? { ...r, userIds: r.userIds.filter((u) => u !== 'me') } : r,
            )
            .filter((r) => r.userIds.length > 0);
        } else if (existing) {
          reactions = m.reactions.map((r) =>
            r.emoji === emoji ? { ...r, userIds: [...r.userIds, 'me'] } : r,
          );
        } else {
          reactions = [...m.reactions, { emoji, userIds: ['me'] }];
        }
        return { ...m, reactions };
      }),
    );
  }, []);

  const markRead = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
    );
  }, []);

  const toggleMute = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, muted: !c.muted } : c)),
    );
  }, []);

  const setNotificationPrefs = useCallback((p: NotificationPrefs) => {
    setPrefs(p);
    AsyncStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(p)).catch(() => {});
  }, []);

  const setAppearance = useCallback((m: AppearanceMode) => {
    setAppearanceState(m);
    AsyncStorage.setItem(STORAGE_KEYS.appearance, JSON.stringify(m)).catch(() => {});
  }, []);

  const setActiveConversation = useCallback((id: string | null) => {
    activeConversationRef.current = id;
    setActiveId(id);
  }, []);

  const dismissBanner = useCallback(() => setBanner(null), []);

  const value = useMemo(
    () => ({
      hydrated,
      connectedServices,
      conversations,
      messages,
      notificationPrefs,
      appearance,
      banner,
      activeConversationId,
      connectService,
      disconnectService,
      sendMessage,
      toggleReaction,
      markRead,
      toggleMute,
      setNotificationPrefs,
      setAppearance,
      setActiveConversation,
      dismissBanner,
    }),
    [
      hydrated,
      connectedServices,
      conversations,
      messages,
      notificationPrefs,
      appearance,
      banner,
      activeConversationId,
      connectService,
      disconnectService,
      sendMessage,
      toggleReaction,
      markRead,
      toggleMute,
      setNotificationPrefs,
      setAppearance,
      setActiveConversation,
      dismissBanner,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChatStore(): ChatStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useChatStore must be used inside ChatStoreProvider');
  return store;
}
