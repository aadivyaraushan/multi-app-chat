import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConnectCard } from '../src/components/ConnectCard';
import { ConversationRow } from '../src/components/ConversationRow';
import { FilterChips, InboxFilter } from '../src/components/FilterChips';
import { SERVICE_ORDER } from '../src/services/capabilities';
import { useChatStore } from '../src/store/ChatStore';
import { useTheme } from '../src/theme';
import { Conversation } from '../src/types';

export default function InboxScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    hydrated,
    connectedServices,
    conversations,
    messages,
    markRead,
    toggleMute,
  } = useChatStore();
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [actionConvo, setActionConvo] = useState<Conversation | null>(null);

  const lastMessageFor = useMemo(() => {
    const map = new Map<string, (typeof messages)[number]>();
    for (const m of messages) {
      if (m.threadParentId) continue; // Slack thread replies don't drive the preview
      const prev = map.get(m.conversationId);
      if (!prev || m.timestamp > prev.timestamp) map.set(m.conversationId, m);
    }
    return map;
  }, [messages]);

  const visible = useMemo(() => {
    let list = [...conversations];
    if (filter === 'unread') list = list.filter((c) => c.unreadCount > 0);
    else if (filter !== 'all') list = list.filter((c) => c.service === filter);
    return list.sort((a, b) => b.lastActivity - a.lastActivity);
  }, [conversations, filter]);

  const unconnected = SERVICE_ORDER.filter((s) => !connectedServices.includes(s));

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  return (
    <View style={[styles.screen, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.appName, { color: t.text }]}>Messages</Text>
        <View style={styles.headerActions}>
          <Pressable
            testID="search-btn"
            onPress={() => router.push('/search')}
            style={styles.headerBtn}
          >
            <Ionicons name="search" size={22} color={t.text} />
          </Pressable>
          <Pressable
            testID="settings-btn"
            onPress={() => router.push('/settings')}
            style={[styles.avatarBtn, { backgroundColor: t.accent }]}
          >
            <Text style={styles.avatarBtnText}>Me</Text>
          </Pressable>
        </View>
      </View>

      {connectedServices.length > 0 && (
        <FilterChips connected={connectedServices} active={filter} onChange={setFilter} />
      )}

      {connectedServices.length === 0 ? (
        // Onboarding: connect-as-you-go. The empty inbox *is* the setup flow.
        <View style={styles.empty} testID="onboarding-empty">
          <Text style={[styles.emptyTitle, { color: t.text }]}>All your chats, one place</Text>
          <Text style={[styles.emptySub, { color: t.textSecondary }]}>
            Connect a service to start. Your conversations appear here the moment it links.
          </Text>
          <View style={styles.cards}>
            {SERVICE_ORDER.map((s) => (
              <ConnectCard key={s} service={s} onPress={() => router.push(`/connect/${s}`)} />
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(c) => c.id}
          testID="inbox-list"
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              lastMessage={lastMessageFor.get(item.id)}
              onPress={() => router.push(`/chat/${item.id}`)}
              onLongPress={() => setActionConvo(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyFilter}>
              <Text style={{ color: t.textSecondary, fontSize: 14 }}>
                {filter === 'unread' ? 'No unread conversations 🎉' : 'No conversations here yet'}
              </Text>
            </View>
          }
          ListFooterComponent={
            unconnected.length > 0 ? (
              <View style={[styles.cards, { paddingHorizontal: 16, paddingTop: 16 }]}>
                {unconnected.map((s) => (
                  <ConnectCard key={s} service={s} onPress={() => router.push(`/connect/${s}`)} />
                ))}
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {/* Long-press actions on a conversation: mark read / mute */}
      <Modal
        transparent
        visible={actionConvo != null}
        animationType="fade"
        onRequestClose={() => setActionConvo(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setActionConvo(null)}>
          <View style={[styles.sheet, { backgroundColor: t.surfaceRaised }]}>
            <Text style={[styles.sheetTitle, { color: t.textSecondary }]}>
              {actionConvo?.title}
            </Text>
            {actionConvo && actionConvo.unreadCount > 0 && (
              <Pressable
                testID="action-mark-read"
                style={styles.sheetAction}
                onPress={() => {
                  markRead(actionConvo.id);
                  setActionConvo(null);
                }}
              >
                <Ionicons name="checkmark-done-outline" size={20} color={t.text} />
                <Text style={[styles.sheetActionText, { color: t.text }]}>Mark as read</Text>
              </Pressable>
            )}
            <Pressable
              testID="action-mute"
              style={styles.sheetAction}
              onPress={() => {
                if (actionConvo) toggleMute(actionConvo.id);
                setActionConvo(null);
              }}
            >
              <Ionicons
                name={actionConvo?.muted ? 'notifications-outline' : 'notifications-off-outline'}
                size={20}
                color={t.text}
              />
              <Text style={[styles.sheetActionText, { color: t.text }]}>
                {actionConvo?.muted ? 'Unmute' : 'Mute'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerBtn: { padding: 4 },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 24,
  },
  cards: { gap: 10 },
  emptyFilter: {
    alignItems: 'center',
    paddingTop: 60,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 8,
  },
  sheetActionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
