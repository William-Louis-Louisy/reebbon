import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { designSystemTokens } from '@/shared/theme';

import { useAppTheme } from '../hooks/use-app-theme';
import { AppText } from './app-text';

export function BrandSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const theme = useAppTheme();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setVisible(false);
    }, designSystemTokens.motion.readingThemeTransition);

    return () => clearTimeout(timeoutId);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(designSystemTokens.motion.quickFeedback)}
      exiting={FadeOut.duration(designSystemTokens.motion.uiTransition)}
      style={[styles.overlay, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}>
        <AppText variant="eyebrow" tone="accent">
          Offline Reader
        </AppText>
        <AppText variant="hero">Reebbon</AppText>
        <View style={[styles.rule, { backgroundColor: theme.accent }]} />
        <AppText tone="muted">
          Fondations Expo, TypeScript strict et design system prêtes pour les prochains sprints.
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    width: '80%',
    maxWidth: 320,
    borderWidth: 1,
    borderRadius: designSystemTokens.radii.lg,
    padding: designSystemTokens.spacing[6],
    gap: designSystemTokens.spacing[3],
  },
  rule: {
    width: 72,
    height: 4,
    borderRadius: designSystemTokens.radii.pill,
  },
});
