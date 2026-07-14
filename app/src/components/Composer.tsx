import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { Message, ServiceCapabilities, VoiceNote } from '../types';

interface Props {
  caps: ServiceCapabilities;
  replyingTo: Message | null;
  onCancelReply: () => void;
  onSend: (opts: { text?: string; imageUri?: string; voiceNote?: VoiceNote }) => void;
  placeholder?: string;
}

// The composer renders only what the conversation's service supports:
// no mic outside WhatsApp, no attach where media isn't available.
export function Composer({ caps, replyingTo, onCancelReply, onSend, placeholder }: Props) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const recordStart = useRef(0);
  const inputRef = useRef<TextInput>(null);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend({ text: trimmed });
    setText('');
    inputRef.current?.focus();
  };

  const attach = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      onSend({ imageUri: result.assets[0].uri });
    }
  };

  const toggleRecord = () => {
    if (!recording) {
      recordStart.current = Date.now();
      setRecording(true);
    } else {
      const durationSec = Math.max(1, Math.round((Date.now() - recordStart.current) / 1000));
      setRecording(false);
      const waveform = Array.from({ length: 20 }, (_, i) => 0.3 + 0.6 * Math.abs(Math.sin(i * 1.7)));
      onSend({ voiceNote: { durationSec, waveform } });
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: t.bg, borderTopColor: t.border }]}>
      {replyingTo && (
        <View style={[styles.replyBar, { backgroundColor: t.surface, borderLeftColor: t.accent }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: t.accent }}>
              Replying to {replyingTo.senderName}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: t.textSecondary }}>
              {replyingTo.text ?? (replyingTo.voiceNote ? 'Voice note' : 'Photo')}
            </Text>
          </View>
          <Pressable onPress={onCancelReply} testID="cancel-reply" style={{ padding: 4 }}>
            <Ionicons name="close" size={18} color={t.textSecondary} />
          </Pressable>
        </View>
      )}
      {recording && (
        <View style={[styles.recordingBar, { backgroundColor: t.surface }]} testID="recording-bar">
          <View style={styles.recordingDot} />
          <Text style={{ color: t.danger, fontSize: 13, fontWeight: '600' }}>
            Recording voice note… tap mic to send
          </Text>
        </View>
      )}
      <View style={styles.row}>
        {caps.media && (
          <Pressable onPress={attach} testID="attach-btn" style={styles.iconBtn}>
            <Ionicons name="add-circle-outline" size={26} color={t.textSecondary} />
          </Pressable>
        )}
        <TextInput
          ref={inputRef}
          testID="composer-input"
          value={text}
          onChangeText={setText}
          placeholder={placeholder ?? 'Message'}
          placeholderTextColor={t.textTertiary}
          style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
          multiline
          onSubmitEditing={send}
          blurOnSubmit={false}
        />
        {caps.voiceNotes && !text.trim() && (
          <Pressable onPress={toggleRecord} testID="mic-btn" style={styles.iconBtn}>
            <Ionicons
              name={recording ? 'stop-circle' : 'mic-outline'}
              size={26}
              color={recording ? t.danger : t.textSecondary}
            />
          </Pressable>
        )}
        <Pressable
          onPress={send}
          testID="send-btn"
          style={[
            styles.sendBtn,
            { backgroundColor: text.trim() ? t.accent : t.chipBg },
          ]}
          disabled={!text.trim()}
        >
          <Ionicons name="arrow-up" size={20} color={text.trim() ? '#FFFFFF' : t.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5484D',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  iconBtn: {
    padding: 6,
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
