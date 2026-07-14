import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Message, ServiceCapabilities } from '../types';

const QUICK_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Props {
  message: Message | null;
  caps: ServiceCapabilities;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onThreadReply?: () => void; // Slack: reply in thread
}

// Long-press action sheet. Which actions appear is driven entirely by the
// service's capability flags — an unsupported action is absent, never disabled.
export function MessageActions({ message, caps, onClose, onReact, onReply, onThreadReply }: Props) {
  const t = useTheme();
  if (!message) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="actions-backdrop">
        <View style={[styles.sheet, { backgroundColor: t.surfaceRaised }]}>
          {caps.reactions && (
            <View style={styles.emojiRow}>
              {QUICK_EMOJI.map((e) => (
                <Pressable
                  key={e}
                  testID={`react-${e}`}
                  onPress={() => {
                    onReact(e);
                    onClose();
                  }}
                  style={styles.emojiBtn}
                >
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {caps.replies && (
            <Pressable
              testID="action-reply"
              style={styles.action}
              onPress={() => {
                onReply();
                onClose();
              }}
            >
              <Ionicons name="arrow-undo-outline" size={20} color={t.text} />
              <Text style={[styles.actionText, { color: t.text }]}>Reply</Text>
            </Pressable>
          )}
          {caps.threads && !message.threadParentId && onThreadReply && (
            <Pressable
              testID="action-thread-reply"
              style={styles.action}
              onPress={() => {
                onThreadReply();
                onClose();
              }}
            >
              <Ionicons name="chatbubbles-outline" size={20} color={t.text} />
              <Text style={[styles.actionText, { color: t.text }]}>Reply in thread</Text>
            </Pressable>
          )}
          {!!message.text && (
            <Pressable
              testID="action-copy"
              style={styles.action}
              onPress={() => {
                Clipboard.setStringAsync(message.text ?? '').catch(() => {});
                onClose();
              }}
            >
              <Ionicons name="copy-outline" size={20} color={t.text} />
              <Text style={[styles.actionText, { color: t.text }]}>Copy</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    gap: 4,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    marginBottom: 8,
  },
  emojiBtn: {
    padding: 6,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
