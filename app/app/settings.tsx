import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SERVICES, SERVICE_ORDER } from '../src/services/capabilities';
import { useChatStore } from '../src/store/ChatStore';
import { useTheme } from '../src/theme';
import { AppearanceMode } from '../src/types';

export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    connectedServices,
    disconnectService,
    notificationPrefs,
    setNotificationPrefs,
    appearance,
    setAppearance,
  } = useChatStore();

  const appearanceModes: AppearanceMode[] = ['light', 'dark', 'system'];

  return (
    <View style={[styles.screen, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="settings-back-btn" onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: t.text }]}>Accounts & Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 28, paddingBottom: 48 }}>
        {/* Accounts */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>ACCOUNTS</Text>
          {SERVICE_ORDER.map((s) => {
            const meta = SERVICES[s];
            const connected = connectedServices.includes(s);
            return (
              <View
                key={s}
                testID={`account-row-${s}`}
                style={[styles.row, { borderBottomColor: t.border }]}
              >
                <View style={[styles.serviceDot, { backgroundColor: meta.brandColor }]}>
                  <Text style={styles.serviceGlyph}>{meta.badgeGlyph}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: t.text }]}>{meta.name}</Text>
                  <Text style={{ fontSize: 12, color: connected ? '#2E9E5B' : t.textTertiary }}>
                    {connected ? 'Connected' : 'Not connected'}
                  </Text>
                </View>
                {connected ? (
                  <Pressable
                    testID={`disconnect-${s}`}
                    onPress={() => disconnectService(s)}
                    style={[styles.smallBtn, { borderColor: t.border }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: t.danger }}>
                      Disconnect
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    testID={`connect-${s}`}
                    onPress={() => router.push(`/connect/${s}`)}
                    style={[styles.smallBtn, { borderColor: t.border }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: t.accent }}>
                      Connect
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>NOTIFICATIONS</Text>
          <View style={[styles.row, { borderBottomColor: t.border }]}>
            <Text style={[styles.rowTitle, { color: t.text, flex: 1 }]}>Allow notifications</Text>
            <Switch
              testID="notif-master"
              value={notificationPrefs.master}
              onValueChange={(v) => setNotificationPrefs({ ...notificationPrefs, master: v })}
            />
          </View>
          {notificationPrefs.master && (
            <>
              {SERVICE_ORDER.map((s) => (
                <View key={s} style={[styles.row, { borderBottomColor: t.border }]}>
                  <View style={[styles.serviceDotSm, { backgroundColor: SERVICES[s].brandColor }]} />
                  <Text style={[styles.rowTitle, { color: t.text, flex: 1 }]}>
                    {SERVICES[s].name}
                  </Text>
                  <Switch
                    testID={`notif-${s}`}
                    value={notificationPrefs.perService[s]}
                    onValueChange={(v) =>
                      setNotificationPrefs({
                        ...notificationPrefs,
                        perService: { ...notificationPrefs.perService, [s]: v },
                      })
                    }
                  />
                </View>
              ))}
              <View style={[styles.row, { borderBottomColor: t.border }]}>
                <Text style={[styles.rowTitle, { color: t.text, flex: 1 }]}>Show previews</Text>
                <Switch
                  testID="notif-previews"
                  value={notificationPrefs.showPreviews}
                  onValueChange={(v) =>
                    setNotificationPrefs({ ...notificationPrefs, showPreviews: v })
                  }
                />
              </View>
            </>
          )}
          <Text style={{ fontSize: 12, color: t.textTertiary, paddingTop: 8 }}>
            Mute individual chats from the chat header or by long-pressing a conversation.
          </Text>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>APPEARANCE</Text>
          <View style={styles.appearanceRow}>
            {appearanceModes.map((m) => {
              const active = appearance === m;
              return (
                <Pressable
                  key={m}
                  testID={`appearance-${m}`}
                  onPress={() => setAppearance(m)}
                  style={[
                    styles.appearanceBtn,
                    {
                      backgroundColor: active ? t.chipActiveBg : t.chipBg,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: active ? t.chipActiveText : t.textSecondary,
                      textTransform: 'capitalize',
                    }}
                  >
                    {m}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
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
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  section: { gap: 2 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  serviceDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceDotSm: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  serviceGlyph: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  smallBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  appearanceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  appearanceBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
});
