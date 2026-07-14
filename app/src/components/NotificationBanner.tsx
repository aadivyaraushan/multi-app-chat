import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Banner, useChatStore } from '../store/ChatStore';
import { SERVICES } from '../services/capabilities';
import { useTheme } from '../theme';

// In-app notification banner (stand-in for push until Sygnal is wired up).
export function NotificationBanner({ banner }: { banner: Banner }) {
  const t = useTheme();
  const router = useRouter();
  const { dismissBanner } = useChatStore();
  const meta = SERVICES[banner.service];

  useEffect(() => {
    const timer = setTimeout(dismissBanner, 4500);
    return () => clearTimeout(timer);
  }, [banner.id, dismissBanner]);

  return (
    <Pressable
      testID="notification-banner"
      onPress={() => {
        dismissBanner();
        router.push(`/chat/${banner.conversationId}`);
      }}
      style={[styles.banner, { backgroundColor: t.surfaceRaised, borderColor: t.border }]}
    >
      <View style={[styles.dot, { backgroundColor: meta.brandColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
          {banner.title} <Text style={{ color: t.textTertiary, fontWeight: '400' }}>· {meta.name}</Text>
        </Text>
        <Text style={{ color: t.textSecondary, fontSize: 13 }} numberOfLines={1}>
          {banner.preview}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
});
