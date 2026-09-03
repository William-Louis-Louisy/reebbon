import '@/global.css';

import { ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import type { AppColorSchemePreferenceService } from '@/application';
import { getNavigationTheme } from '@/shared/theme';
import { useOfflineFonts } from '@/shared/theme/fonts';

import { BrandSplashOverlay } from '../components/brand-splash-overlay';
import {
  AppColorSchemeProvider,
  type AppColorSchemePersistenceOperation,
  useAppColorScheme,
} from '../hooks/use-app-color-scheme';
import AppTabs from '../navigation/app-tabs';

void SplashScreen.preventAutoHideAsync();

interface RootLayoutProps {
  readonly appColorSchemePreferences: Pick<
    AppColorSchemePreferenceService,
    'load' | 'save'
  >;
}

export default function RootLayout({
  appColorSchemePreferences,
}: RootLayoutProps) {
  const [fontsLoaded, fontError] = useOfflineFonts();

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppColorSchemeProvider
      onPersistenceError={showAppColorSchemePersistenceError}
      preferences={appColorSchemePreferences}>
      <ThemedApplication />
    </AppColorSchemeProvider>
  );
}

function ThemedApplication() {
  const colorScheme = useAppColorScheme();
  const navigationTheme = getNavigationTheme(colorScheme);

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView
      style={[
        styles.root,
        { backgroundColor: navigationTheme.colors.background },
      ]}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <BrandSplashOverlay />
        <AppTabs />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function showAppColorSchemePersistenceError(
  operation: AppColorSchemePersistenceOperation,
): void {
  Alert.alert(
    operation === 'load'
      ? 'Apparence non restaurée'
      : 'Apparence non enregistrée',
    operation === 'load'
      ? 'Reebbon utilise l’interface claire, car le réglage enregistré est indisponible.'
      : 'Le thème reste appliqué pour cette session, mais il ne pourra peut-être pas être restauré au prochain lancement.',
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
