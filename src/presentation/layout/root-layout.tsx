import '@/global.css';

import { ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { getNavigationTheme } from '@/shared/theme';
import { useOfflineFonts } from '@/shared/theme/fonts';

import { BrandSplashOverlay } from '../components/brand-splash-overlay';
import { useAppColorScheme } from '../hooks/use-app-color-scheme';
import AppTabs from '../navigation/app-tabs';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useAppColorScheme();
  const [fontsLoaded, fontError] = useOfflineFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={getNavigationTheme(colorScheme)}>
      <BrandSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
