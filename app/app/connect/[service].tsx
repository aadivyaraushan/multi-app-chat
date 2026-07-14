import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SERVICES } from '../../src/services/capabilities';
import { useChatStore } from '../../src/store/ChatStore';
import { useTheme } from '../../src/theme';
import { ServiceId } from '../../src/types';

// Pairing-code pattern rendered while waiting for the bridge to report a scan.
// Deterministic stand-in for the real QR payload the WhatsApp bridge emits.
function QrPattern({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    const size = 21;
    let h = 2166136261;
    for (const ch of seed) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    const out: boolean[] = [];
    for (let i = 0; i < size * size; i++) {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      out.push((h & 3) === 0 ? false : (h & 1) === 1);
    }
    // corner finder squares
    const finder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 7; c++) {
          const edge = r === 0 || r === 6 || c === 0 || c === 6;
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          out[(r0 + r) * size + (c0 + c)] = edge || core;
        }
    };
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);
    return { cells: out, size };
  }, [seed]);

  return (
    <View style={styles.qrBox} testID="whatsapp-qr">
      {Array.from({ length: cells.size }).map((_, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {Array.from({ length: cells.size }).map((__, c) => (
            <View
              key={c}
              style={{
                width: 9,
                height: 9,
                backgroundColor: cells.cells[r * cells.size + c] ? '#111' : '#FFF',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function ConnectScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { service } = useLocalSearchParams<{ service: ServiceId }>();
  const { connectService, connectedServices } = useChatStore();
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');

  const meta = service ? SERVICES[service] : undefined;
  if (!meta) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
        <Text style={{ color: t.textSecondary, padding: 24 }}>Unknown service.</Text>
      </View>
    );
  }

  const connected = connectedServices.includes(meta.id);

  const finish = () => {
    setBusy(true);
    // In the seeded provider the "bridge" links instantly; the Matrix provider
    // will resolve this when the bridge confirms the session.
    setTimeout(() => {
      connectService(meta.id);
      setBusy(false);
      router.back();
    }, 700);
  };

  const credentialsValid =
    meta.connectKind === 'qr' ||
    (meta.connectKind === 'token' ? token.trim().length > 0 : username.trim().length > 0 && password.trim().length > 0);

  return (
    <View style={[styles.screen, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="connect-back-btn" onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </Pressable>
        <View style={[styles.badge, { backgroundColor: meta.brandColor }]}>
          <Text style={styles.badgeGlyph}>{meta.badgeGlyph}</Text>
        </View>
        <Text style={[styles.headerTitle, { color: t.text }]}>Connect {meta.name}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, alignItems: 'stretch' }}>
        {connected ? (
          <View style={styles.centered}>
            <Ionicons name="checkmark-circle" size={48} color="#2E9E5B" />
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>
              {meta.name} is connected
            </Text>
          </View>
        ) : meta.connectKind === 'qr' ? (
          <>
            <Text style={[styles.instructions, { color: t.textSecondary }]}>
              1. Open WhatsApp on your phone{'\n'}
              2. Tap Settings → Linked Devices → Link a Device{'\n'}
              3. Point your phone at this code
            </Text>
            <View style={styles.centered}>
              <QrPattern seed={`multichat-${Date.now() % 100000}`} />
              <Text style={{ color: t.textTertiary, fontSize: 12, marginTop: 10 }}>
                Code refreshes automatically while pairing
              </Text>
            </View>
            <Pressable
              testID="qr-scanned-btn"
              onPress={finish}
              disabled={busy}
              style={[styles.primaryBtn, { backgroundColor: meta.brandColor }]}
            >
              {busy ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryBtnText}>I've scanned the code</Text>
              )}
            </Pressable>
          </>
        ) : meta.connectKind === 'token' ? (
          <>
            <Text style={[styles.instructions, { color: t.textSecondary }]}>
              Paste a Slack user token for your workspace. The token stays on your bridge server —
              it is never stored on this device.
            </Text>
            <TextInput
              testID="token-input"
              value={token}
              onChangeText={setToken}
              placeholder="xoxs-…"
              placeholderTextColor={t.textTertiary}
              autoCapitalize="none"
              style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
            />
            <Pressable
              testID="connect-submit"
              onPress={finish}
              disabled={busy || !credentialsValid}
              style={[
                styles.primaryBtn,
                { backgroundColor: credentialsValid ? meta.brandColor : t.chipBg },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text
                  style={[
                    styles.primaryBtnText,
                    !credentialsValid && { color: t.textTertiary },
                  ]}
                >
                  Connect workspace
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.instructions, { color: t.textSecondary }]}>
              Sign in with your {meta.name} account. Credentials are sent to your own bridge
              server, never to a third party.
            </Text>
            <TextInput
              testID="username-input"
              value={username}
              onChangeText={setUsername}
              placeholder={meta.id === 'linkedin' ? 'Email' : 'Username'}
              placeholderTextColor={t.textTertiary}
              autoCapitalize="none"
              style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
            />
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={t.textTertiary}
              secureTextEntry
              style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
            />
            <View testID="tos-warning" style={[styles.warning, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Ionicons name="warning-outline" size={18} color="#C77D18" />
              <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: t.textSecondary }}>
                {meta.name} does not offer an official messaging API. This connection uses an
                unofficial one and is against their terms of service — there is a real (if small)
                risk of account restriction. Connect only if you accept that.
              </Text>
            </View>
            <Pressable
              testID="connect-submit"
              onPress={finish}
              disabled={busy || !credentialsValid}
              style={[
                styles.primaryBtn,
                { backgroundColor: credentialsValid ? meta.brandColor : t.chipBg },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text
                  style={[
                    styles.primaryBtnText,
                    !credentialsValid && { color: t.textTertiary },
                  ]}
                >
                  Sign in & connect
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
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
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  instructions: {
    fontSize: 14,
    lineHeight: 22,
  },
  centered: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  qrBox: {
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  warning: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
