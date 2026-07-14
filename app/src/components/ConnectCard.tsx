import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SERVICES } from '../services/capabilities';
import { useTheme } from '../theme';
import { ServiceId } from '../types';

interface Props {
  service: ServiceId;
  onPress: () => void;
}

export function ConnectCard({ service, onPress }: Props) {
  const t = useTheme();
  const meta = SERVICES[service];
  return (
    <Pressable
      testID={`connect-card-${service}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.surfaceRaised, borderColor: t.border },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: meta.brandColor }]}>
        <Text style={styles.iconGlyph}>{meta.badgeGlyph}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: t.text }]}>Connect {meta.name}</Text>
        <Text style={[styles.hint, { color: t.textSecondary }]} numberOfLines={2}>
          {meta.connectHint}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  hint: {
    fontSize: 13,
  },
});
