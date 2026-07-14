import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../src/components/Avatar';
import { FilterChips, InboxFilter } from '../src/components/FilterChips';
import { previewText } from '../src/components/ConversationRow';
import { useChatStore } from '../src/store/ChatStore';
import { useTheme } from '../src/theme';
import { Conversation, Message } from '../src/types';

type Result =
  | { kind: 'conversation'; conversation: Conversation }
  | { kind: 'message'; conversation: Conversation; message: Message };

export default function SearchScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { conversations, messages, connectedServices } = useChatStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const inScope = (c: Conversation) =>
      filter === 'all' ? true : filter === 'unread' ? c.unreadCount > 0 : c.service === filter;
    const convoById = new Map(conversations.map((c) => [c.id, c]));
    const out: Result[] = [];
    for (const c of conversations) {
      if (inScope(c) && c.title.toLowerCase().includes(q)) {
        out.push({ kind: 'conversation', conversation: c });
      }
    }
    for (const m of messages) {
      const c = convoById.get(m.conversationId);
      if (c && inScope(c) && m.text?.toLowerCase().includes(q)) {
        out.push({ kind: 'message', conversation: c, message: m });
      }
    }
    return out.slice(0, 50);
  }, [query, filter, conversations, messages]);

  return (
    <View style={[styles.screen, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="search-back-btn" onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </Pressable>
        <View style={[styles.searchBox, { backgroundColor: t.surface }]}>
          <Ionicons name="search" size={17} color={t.textTertiary} />
          <TextInput
            testID="search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="Search conversations and messages"
            placeholderTextColor={t.textTertiary}
            autoFocus
            style={[styles.searchInput, { color: t.text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} testID="search-clear">
              <Ionicons name="close-circle" size={17} color={t.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <FilterChips connected={connectedServices} active={filter} onChange={setFilter} />

      <FlatList
        data={results}
        testID="search-results"
        keyExtractor={(r, i) =>
          r.kind === 'conversation' ? `c-${r.conversation.id}` : `m-${r.message.id}-${i}`
        }
        renderItem={({ item }) => {
          const c = item.conversation;
          const main = c.participants[0];
          return (
            <Pressable
              testID={
                item.kind === 'conversation'
                  ? `result-convo-${c.id}`
                  : `result-msg-${item.message.id}`
              }
              onPress={() => router.push(`/chat/${c.id}`)}
              style={({ pressed }) => [styles.result, pressed && { backgroundColor: t.surface }]}
            >
              <Avatar
                initials={c.isChannel ? '#' : main?.initials ?? '?'}
                color={main?.avatarColor ?? t.textTertiary}
                size={40}
                service={c.service}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultTitle, { color: t.text }]} numberOfLines={1}>
                  {c.title}
                </Text>
                <Text style={{ fontSize: 13, color: t.textSecondary }} numberOfLines={1}>
                  {item.kind === 'message'
                    ? `${item.message.senderName}: ${previewText(item.message)}`
                    : 'Conversation'}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: t.textTertiary, fontSize: 14 }}>
              {query.trim() ? 'No matches' : 'Search across every connected service'}
            </Text>
          </View>
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
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
});
