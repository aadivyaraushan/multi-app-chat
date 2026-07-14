import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationBanner } from '../src/components/NotificationBanner';
import { ChatStoreProvider, useChatStore } from '../src/store/ChatStore';
import { darkTheme, lightTheme, ThemeContext } from '../src/theme';

function Shell() {
  const { appearance, banner } = useChatStore();
  const system = useColorScheme();
  const mode = appearance === 'system' ? (system ?? 'light') : appearance;
  const theme = mode === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: theme.bg }} testID={`theme-${mode}`}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
          }}
        />
        {banner && <NotificationBanner banner={banner} />}
      </View>
    </ThemeContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ChatStoreProvider>
        <Shell />
      </ChatStoreProvider>
    </SafeAreaProvider>
  );
}
