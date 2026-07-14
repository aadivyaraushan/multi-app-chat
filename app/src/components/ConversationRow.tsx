import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Conversation, Message } from '../types';
import { Avatar } from './Avatar';

interface Props {
  conversation: Conversation;
  lastMessage?: Message;
  onPress: () => void;
  onLongPress: () => void; // mute / mark read actions
}

function relativeTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return 'now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
  return `${Math.floor(d / 86_400_000)}d`;
}

export function previewText(m?: Message): string {
  if (!m) return '';
  if (m.voiceNote) return `🎤 Voice note (${m.voiceNote.durationSec}s)`;
  if (m.imageUri) return '📷 Photo';
  return m.text ?? '';
}

export function ConversationRow({ conversation, lastMessage, onPress, onLongPress }: Props) {
  const t = useTheme();
  const c = conversation;
  const main = c.participants[0];
  const preview = c.typing
    ? `${c.typing} is typing…`
    : (lastMessage?.senderId === 'me' ? 'You: ' : '') + previewText(lastMessage);

  return (
    <Pressable
      testID={`convo-${c.id}`}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.surface }]}
    >
      <Avatar
        initials={c.isChannel ? '#' : main?.initials ?? '?'}
        color={main?.avatarColor ?? t.textTertiary}
        service={c.service}
      />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text numberOfLines={1} style={[styles.title, { color: t.text }]}>
            {c.title}
          </Text>
          <Text style={[styles.time, { color: c.unreadCount > 0 ? t.unread : t.textTertiary }]}>
            {relativeTime(c.lastActivity)}
          </Text>
        </View>
        <View style={styles.bottomLine}>
          <Text
            numberOfLines={1}
            style={[
              styles.preview,
              { color: c.typing ? t.accent : t.textSecondary },
              c.typing ? { fontStyle: 'italic' } : null,
            ]}
          >
            {preview}
          </Text>
          {c.muted && (
            <Ionicons name="notifications-off-outline" size={14} color={t.textTertiary} />
          )}
          {c.unreadCount > 0 && (
            <View testID={`unread-${c.id}`} style={[styles.unreadDot, { backgroundColor: t.unread }]}>
              <Text style={styles.unreadCount}>{c.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    alignItems: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  time: {
    fontSize: 12,
    fontWeight: '500',
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  preview: {
    fontSize: 14,
    flex: 1,
  },
  unreadDot: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
