import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../src/components/Avatar';
import { Composer } from '../../src/components/Composer';
import { MessageActions } from '../../src/components/MessageActions';
import { MessageBubble } from '../../src/components/MessageBubble';
import { SERVICES } from '../../src/services/capabilities';
import { useChatStore } from '../../src/store/ChatStore';
import { useTheme } from '../../src/theme';
import { Message } from '../../src/types';

export default function ChatScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    conversations,
    messages,
    sendMessage,
    toggleReaction,
    markRead,
    toggleMute,
    setActiveConversation,
  } = useChatStore();
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const listRef = useRef<FlatList>(null);

  const convo = conversations.find((c) => c.id === id);

  useEffect(() => {
    if (!id) return;
    setActiveConversation(id);
    markRead(id);
    return () => setActiveConversation(null);
  }, [id, markRead, setActiveConversation]);

  const convoMessages = useMemo(
    () =>
      messages
        .filter((m) => m.conversationId === id && !m.threadParentId)
        .sort((a, b) => a.timestamp - b.timestamp),
    [messages, id],
  );

  const threadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of messages) {
      if (m.conversationId === id && m.threadParentId) {
        counts.set(m.threadParentId, (counts.get(m.threadParentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [messages, id]);

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  if (!convo) {
    return (
      <View style={[styles.screen, { backgroundColor: t.bg, paddingTop: insets.top }]}>
        <Text style={{ color: t.textSecondary, padding: 24 }}>Conversation not found.</Text>
      </View>
    );
  }

  const meta = SERVICES[convo.service];
  const caps = meta.capabilities;
  const main = convo.participants[0];

  return (
    <View style={[styles.screen, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </Pressable>
        <Avatar
          initials={convo.isChannel ? '#' : main?.initials ?? '?'}
          color={main?.avatarColor ?? t.textTertiary}
          size={36}
          service={convo.service}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: t.text }]} numberOfLines={1}>
            {convo.title}
          </Text>
          <Text style={[styles.headerSub, { color: convo.typing ? t.accent : t.textTertiary }]} numberOfLines={1}>
            {convo.typing
              ? `${convo.typing} is typing…`
              : convo.isChannel
                ? `${meta.name} channel`
                : meta.name}
          </Text>
        </View>
        <Pressable testID="chat-mute-btn" onPress={() => toggleMute(convo.id)} style={styles.backBtn}>
          <Ionicons
            name={convo.muted ? 'notifications-off' : 'notifications-outline'}
            size={21}
            color={convo.muted ? t.danger : t.text}
          />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={convoMessages}
        keyExtractor={(m) => m.id}
        testID="message-list"
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            replyTo={item.replyToId ? byId.get(item.replyToId) : undefined}
            caps={caps}
            isGroup={convo.isGroup}
            threadReplyCount={threadCounts.get(item.id)}
            onLongPress={() => setActionMessage(item)}
            onPressThread={() => router.push(`/thread/${convo.id}/${item.id}`)}
            onToggleReaction={(emoji) => toggleReaction(item.id, emoji)}
          />
        )}
        contentContainerStyle={{ paddingVertical: 12 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      <Composer
        caps={caps}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        placeholder={`Message ${convo.isChannel ? convo.title : main?.name?.split(' ')[0] ?? ''}`}
        onSend={(opts) => {
          sendMessage(convo.id, { ...opts, replyToId: replyingTo?.id });
          setReplyingTo(null);
        }}
      />

      <MessageActions
        message={actionMessage}
        caps={caps}
        onClose={() => setActionMessage(null)}
        onReact={(emoji) => actionMessage && toggleReaction(actionMessage.id, emoji)}
        onReply={() => actionMessage && setReplyingTo(actionMessage)}
        onThreadReply={
          caps.threads && actionMessage
            ? () => router.push(`/thread/${convo.id}/${actionMessage.id}`)
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
  },
});
