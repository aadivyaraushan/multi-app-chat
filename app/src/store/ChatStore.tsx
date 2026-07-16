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
import {
  ChatProvider,
  ConnectCredentials,
  createProvider,
  ProviderEvent,
  SendOptions,
} from '../providers';
import {
  AppearanceMode,
  Conversation,
  Message,
  NotificationPrefs,
  ServiceId,
} from '../types';

// The store owns UI-only concerns (notification prefs, appearance, the active
// chat, the in-app banner) and mirrors data out of whichever ChatProvider is
// active. It never touches a service directly — that lives behind the provider.

const STORAGE_KEYS = {
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

interface ChatStore {
  hydrated: boolean;
  connectedServices: ServiceId[];
  conversations: Conversation[];
  messages: Message[];
  notificationPrefs: NotificationPrefs;
  appearance: AppearanceMode;
  banner: Banner | null;
  activeConversationId: string | null;

  requestPairingCode: (service: ServiceId, phone: string) => Promise<string>;
  connectService: (s: ServiceId, creds?: ConnectCredentials) => Promise<void>;
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

let bannerCounter = 0;

export function ChatStoreProvider({ children }: { children: React.ReactNode }) {
  const providerRef = useRef<ChatProvider | null>(null);
  if (!providerRef.current) providerRef.current = createProvider();
  const provider = providerRef.current;

  const [hydrated, setHydrated] = useState(false);
  const [connectedServices, setConnected] = useState<ServiceId[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notificationPrefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [appearance, setAppearanceState] = useState<AppearanceMode>('system');
  const [banner, setBanner] = useState<Banner | null>(null);
  const [activeConversationId, setActiveId] = useState<string | null>(null);

  const activeConversationRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const prefsRef = useRef<NotificationPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    prefsRef.current = notificationPrefs;
  }, [notificationPrefs]);

  // Mirror provider snapshots into React state.
  const pullConversations = useCallback(() => {
    setConnected(provider.getConnectedServices());
    setConversations(provider.getConversations());
  }, [provider]);
  const pullMessages = useCallback(() => {
    setMessages(provider.getMessages());
  }, [provider]);

  const maybeBanner = useCallback((conversationId: string, message: Message) => {
    const prefs = prefsRef.current;
    const convo = conversationsRef.current.find((c) => c.id === conversationId);
    if (!convo) return;
    const viewing = activeConversationRef.current === conversationId;
    if (prefs.master && prefs.perService[convo.service] && !convo.muted && !viewing) {
      setBanner({
        id: `banner-${bannerCounter++}`,
        conversationId,
        service: convo.service,
        title: convo.title,
        preview: prefs.showPreviews ? message.text ?? 'New message' : 'New message',
      });
    }
  }, []);

  useEffect(() => {
    const unsub = provider.subscribe((e: ProviderEvent) => {
      switch (e.type) {
        case 'ready':
        case 'connected':
        case 'disconnected':
          // These change both the conversation set and the message set.
          pullConversations();
          pullMessages();
          break;
        case 'conversations':
          // Metadata only (unread, mute, typing, ordering).
          pullConversations();
          break;
        case 'messages':
          pullMessages();
          break;
        case 'message':
          pullMessages();
          pullConversations();
          if (e.incoming) maybeBanner(e.conversationId, e.message);
          break;
      }
    });

    (async () => {
      try {
        const [prefs, app] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.prefs),
          AsyncStorage.getItem(STORAGE_KEYS.appearance),
        ]);
        if (prefs) setPrefs(JSON.parse(prefs));
        if (app) setAppearanceState(JSON.parse(app));
        await provider.start();
        pullConversations();
        pullMessages();
      } finally {
        setHydrated(true);
      }
    })();

    return () => {
      unsub();
      provider.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestPairingCode = useCallback(
    (service: ServiceId, phone: string) => provider.requestPairingCode(service, phone),
    [provider],
  );

  const connectService = useCallback(
    async (service: ServiceId, creds: ConnectCredentials = {}) => {
      await provider.connectService(service, creds);
    },
    [provider],
  );

  const disconnectService = useCallback(
    (service: ServiceId) => {
      provider.disconnectService(service);
    },
    [provider],
  );

  const sendMessage = useCallback(
    (conversationId: string, opts: SendOptions) => {
      provider.sendMessage(conversationId, opts);
    },
    [provider],
  );

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      provider.toggleReaction(messageId, emoji);
    },
    [provider],
  );

  const markRead = useCallback(
    (conversationId: string) => {
      provider.markRead(conversationId);
    },
    [provider],
  );

  const toggleMute = useCallback(
    (conversationId: string) => {
      provider.toggleMute(conversationId);
    },
    [provider],
  );

  const setNotificationPrefs = useCallback((p: NotificationPrefs) => {
    setPrefs(p);
    AsyncStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(p)).catch(() => {});
  }, []);

  const setAppearance = useCallback((m: AppearanceMode) => {
    setAppearanceState(m);
    AsyncStorage.setItem(STORAGE_KEYS.appearance, JSON.stringify(m)).catch(() => {});
  }, []);

  const setActiveConversation = useCallback(
    (id: string | null) => {
      activeConversationRef.current = id;
      setActiveId(id);
      provider.setActiveConversation(id);
    },
    [provider],
  );

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
      requestPairingCode,
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
      requestPairingCode,
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
