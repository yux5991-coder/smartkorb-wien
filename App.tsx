import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useCatalogStore } from './src/data';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useProfileStore } from './src/store/useProfileStore';
import { setFormatLanguage } from './src/utils/format';

/**
 * SmartKorb Wien.
 *
 * Offer data comes from the daily snapshot published by `pipeline/`; the app
 * falls back to the cached and then to the bundled catalog. See
 * `src/data/index.ts`.
 */
export default function App() {
  const language = useProfileStore((state) => state.language);
  const bootstrap = useCatalogStore((state) => state.bootstrap);
  const refresh = useCatalogStore((state) => state.refresh);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // prices, dates and amounts follow the UI language
  setFormatLanguage(language);

  // coming back from the background is the natural moment to pick up the day's
  // new offers — `refresh` itself no-ops while the data is still fresh
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        refresh();
      }
      appState.current = next;
    });
    return () => subscription.remove();
  }, [refresh]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
