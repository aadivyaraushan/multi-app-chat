import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Composer } from '../../../src/components/Composer';
import { MessageActions } from '../../../src/components/MessageActions';
import { MessageBubble } from '../../../src/components/MessageBubble';
import { SERVICES } from '../../../src/services/capabilities';
import { useChatStore } from '../../../src/store/ChatStore';
import { useTheme } from '../../../src/theme';
import { Message } from '../../../src/types';

// Slack thread view: the parent message pinned up top, replies below,
// composer posts into the thread.
export default function ThreadScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { conversationId, messageId } = useLocalSearchParams<{
    conversationId: string;
    messageId: string;
  }>();
  const { conversations, messages, sendMessage, toggleReaction } = useChatStore();
  const [actionMessage, setActionMessage] = useState<Message | null>(null);

  const convo = conversations.find((c) => c.id === conversationId);
  const parent = messages.find((m) => m.id === messageId);

  const threadMessages = useMemo(
    () =>
      messages
        .filter((m) => m.threadParentId === messageId)
        .sort((a, b) => a.timestamp - b.timestamp),
    [messages, messageId],
  );

  if (!convo || !parent) {
    return (
      <View style={[styles.screen, { backgroundColor: t.bg, paddingTop: insets.top }]}>
        <Text style={{ color: t.textSecondary, padding: 24 }}>Thread not found.</Text>
      </View>
    );
  }

  const caps = SERVICES[convo.service].capabilities;

  return (
    <View style={[styles.screen, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Pressable testID="thread-back-btn" onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: t.text }]}>Thread</Text>
          <Text style={{ fontSize: 12, color: t.textTertiary }} numberOfLines={1}>
            {convo.title}
          </Text>
        </View>
      </View>

      <FlatList
        data={threadMessages}
        keyExtractor={(m) => m.id}
        testID="thread-list"
        ListHeaderComponent={
          <View style={[styles.parentWrap, { borderBottomColor: t.border }]}>
            <MessageBubble
              message={parent}
              caps={caps}
              isGroup={convo.isGroup}
              onLongPress={() => setActionMessage(parent)}
              onToggleReaction={(emoji) => toggleReaction(parent.id, emoji)}
            />
            <Text style={[styles.repliesLabel, { color: t.textTertiary }]}>
              {threadMessages.length} {threadMessages.length === 1 ? 'reply' : 'replies'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            caps={caps}
            isGroup={convo.isGroup}
            onLongPress={() => setActionMessage(item)}
            onToggleReaction={(emoji) => toggleReaction(item.id, emoji)}
          />
        )}
        contentContainerStyle={{ paddingVertical: 12 }}
      />

      <Composer
        caps={caps}
        replyingTo={null}
        onCancelReply={() => {}}
        placeholder="Reply in thread"
        onSend={(opts) => sendMessage(convo.id, { ...opts, threadParentId: parent.id })}
      />

      <MessageActions
        message={actionMessage}
        caps={caps}
        onClose={() => setActionMessage(null)}
        onReact={(emoji) => actionMessage && toggleReaction(actionMessage.id, emoji)}
        onReply={() => {}}
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  parentWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
    marginBottom: 10,
  },
  repliesLabel: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
});
