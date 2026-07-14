import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Message, ServiceCapabilities } from '../types';

interface Props {
  message: Message;
  replyTo?: Message;
  caps: ServiceCapabilities;
  isGroup: boolean;
  threadReplyCount?: number; // Slack only
  onLongPress: () => void;
  onPressThread?: () => void;
  onToggleReaction: (emoji: string) => void;
}

function StatusTicks({ status, caps }: { status: Message['status']; caps: ServiceCapabilities }) {
  const t = useTheme();
  if (status === 'sending') return <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.7)" />;
  if (status === 'sent') return <Ionicons name="checkmark" size={13} color="rgba(255,255,255,0.7)" />;
  if (status === 'delivered')
    return <Ionicons name="checkmark-done" size={13} color="rgba(255,255,255,0.7)" />;
  // read
  if (!caps.readReceipts)
    return <Ionicons name="checkmark-done" size={13} color="rgba(255,255,255,0.7)" />;
  return <Ionicons testID="ticks-read" name="checkmark-done" size={13} color="#7EE0FF" />;
}

function VoiceNoteView({ message, mine }: { message: Message; mine: boolean }) {
  const t = useTheme();
  const vn = message.voiceNote!;
  const color = mine ? '#FFFFFF' : t.text;
  return (
    <View style={styles.voiceRow} testID={`voice-${message.id}`}>
      <Ionicons name="play-circle" size={30} color={color} />
      <View style={styles.waveform}>
        {vn.waveform.map((a, i) => (
          <View
            key={i}
            style={{
              width: 3,
              borderRadius: 2,
              height: 4 + a * 18,
              backgroundColor: mine ? 'rgba(255,255,255,0.85)' : t.textSecondary,
            }}
          />
        ))}
      </View>
      <Text style={{ color: mine ? 'rgba(255,255,255,0.85)' : t.textSecondary, fontSize: 12 }}>
        0:{String(vn.durationSec).padStart(2, '0')}
      </Text>
    </View>
  );
}

export function MessageBubble({
  message,
  replyTo,
  caps,
  isGroup,
  threadReplyCount,
  onLongPress,
  onPressThread,
  onToggleReaction,
}: Props) {
  const t = useTheme();
  const mine = message.senderId === 'me';

  return (
    <View style={[styles.wrap, mine ? styles.wrapMine : styles.wrapThem]}>
      <Pressable
        testID={`bubble-${message.id}`}
        onLongPress={onLongPress}
        delayLongPress={300}
        style={[
          styles.bubble,
          { backgroundColor: mine ? t.bubbleMe : t.bubbleThem },
          mine ? styles.bubbleMine : styles.bubbleThem,
        ]}
      >
        {isGroup && !mine && (
          <Text style={[styles.sender, { color: t.accent }]}>{message.senderName}</Text>
        )}
        {replyTo && (
          <View
            style={[
              styles.replyPreview,
              { borderLeftColor: mine ? 'rgba(255,255,255,0.6)' : t.accent, backgroundColor: mine ? 'rgba(255,255,255,0.12)' : 'rgba(127,127,127,0.1)' },
            ]}
          >
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, fontWeight: '600', color: mine ? '#FFFFFF' : t.text }}
            >
              {replyTo.senderName}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, color: mine ? 'rgba(255,255,255,0.8)' : t.textSecondary }}
            >
              {replyTo.text ?? (replyTo.voiceNote ? 'Voice note' : 'Photo')}
            </Text>
          </View>
        )}
        {message.imageUri && (
          <Image
            source={{ uri: message.imageUri }}
            style={styles.image}
            testID={`image-${message.id}`}
          />
        )}
        {message.voiceNote && <VoiceNoteView message={message} mine={mine} />}
        {!!message.text && (
          <Text style={[styles.text, { color: mine ? t.bubbleMeText : t.bubbleThemText }]}>
            {message.text}
          </Text>
        )}
        <View style={styles.metaRow}>
          <Text
            style={{
              fontSize: 10,
              color: mine ? 'rgba(255,255,255,0.7)' : t.textTertiary,
            }}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {mine && <StatusTicks status={message.status} caps={caps} />}
        </View>
      </Pressable>

      {message.reactions.length > 0 && (
        <View style={[styles.reactionsRow, mine ? { justifyContent: 'flex-end' } : null]}>
          {message.reactions.map((r) => {
            const minedIt = r.userIds.includes('me');
            return (
              <Pressable
                key={r.emoji}
                testID={`reaction-${message.id}-${r.emoji}`}
                onPress={() => onToggleReaction(r.emoji)}
                style={[
                  styles.reactionPill,
                  {
                    backgroundColor: t.surfaceRaised,
                    borderColor: minedIt ? t.accent : t.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 12 }}>{r.emoji}</Text>
                {r.userIds.length > 1 && (
                  <Text style={{ fontSize: 11, color: t.textSecondary }}>{r.userIds.length}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {caps.threads && threadReplyCount != null && threadReplyCount > 0 && (
        <Pressable
          testID={`thread-link-${message.id}`}
          onPress={onPressThread}
          style={[styles.threadLink, mine ? { alignSelf: 'flex-end' } : null]}
        >
          <Ionicons name="chatbubbles-outline" size={13} color={t.accent} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: t.accent }}>
            {threadReplyCount} {threadReplyCount === 1 ? 'reply' : 'replies'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: 3,
    paddingHorizontal: 12,
    maxWidth: '82%',
  },
  wrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  wrapThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
    gap: 4,
  },
  bubbleMine: { borderBottomRightRadius: 5 },
  bubbleThem: { borderBottomLeftRadius: 5 },
  sender: {
    fontSize: 12,
    fontWeight: '700',
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 1,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  image: {
    width: 220,
    height: 160,
    borderRadius: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
  },
  reactionsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: -6,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  threadLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 6,
  },
});
