import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
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

// WhatsApp "link with phone number" codes are 8 characters, shown as two
// groups of four. Excludes visually ambiguous glyphs (0/O, 1/I) as WhatsApp does.
function makePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

function digitsOnly(s: string): string {
  return s.replace(/[^\d]/g, '');
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
  const [phone, setPhone] = useState('');
  const [pairingCode, setPairingCode] = useState('');

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

  const phoneValid = digitsOnly(phone).length >= 8;

  const requestCode = () => {
    // The real bridge returns this code from `login phone <number>`; here we
    // generate one locally so the pairing UX can be exercised end-to-end.
    setPairingCode(makePairingCode());
  };

  const credentialsValid =
    meta.connectKind === 'pairing' ||
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
        ) : meta.connectKind === 'pairing' ? (
          !pairingCode ? (
            // Step 1 — phone number entry
            <>
              <Text style={[styles.instructions, { color: t.textSecondary }]}>
                Enter the phone number for this WhatsApp account, including its
                country code. We'll give you an 8-character code to type into
                WhatsApp on your phone.
              </Text>
              <TextInput
                testID="phone-input"
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 555 123 4567"
                placeholderTextColor={t.textTertiary}
                keyboardType="phone-pad"
                style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
              />
              <Pressable
                testID="request-code-btn"
                onPress={requestCode}
                disabled={!phoneValid}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: phoneValid ? meta.brandColor : t.chipBg },
                ]}
              >
                <Text style={[styles.primaryBtnText, !phoneValid && { color: t.textTertiary }]}>
                  Get pairing code
                </Text>
              </Pressable>
            </>
          ) : (
            // Step 2 — show the 8-character code to enter on the phone
            <>
              <Text style={[styles.instructions, { color: t.textSecondary }]}>
                On your phone: open WhatsApp → Settings → Linked Devices → Link a
                Device → <Text style={{ fontWeight: '700' }}>Link with phone number instead</Text>,
                then enter this code:
              </Text>
              <View style={styles.centered}>
                <View
                  testID="whatsapp-pairing-code"
                  style={[styles.codeBox, { backgroundColor: t.surface, borderColor: t.border }]}
                >
                  <Text style={[styles.codeText, { color: t.text }]}>{pairingCode}</Text>
                </View>
                <Text style={{ color: t.textTertiary, fontSize: 12, marginTop: 10 }}>
                  Code expires after a minute. Request a new one if it times out.
                </Text>
              </View>
              <Pressable
                testID="code-entered-btn"
                onPress={finish}
                disabled={busy}
                style={[styles.primaryBtn, { backgroundColor: meta.brandColor }]}
              >
                {busy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>I've entered the code</Text>
                )}
              </Pressable>
              <Pressable
                testID="change-number-btn"
                onPress={() => {
                  setPairingCode('');
                  setPhone('');
                }}
                style={styles.secondaryBtn}
              >
                <Text style={{ color: t.accent, fontSize: 14, fontWeight: '600' }}>
                  Use a different number
                </Text>
              </Pressable>
            </>
          )
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
  codeBox: {
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  codeText: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 10,
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
