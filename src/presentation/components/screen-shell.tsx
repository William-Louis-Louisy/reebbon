import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { designSystemTokens } from '@/shared/theme';

import { useAppTheme } from '../hooks/use-app-theme';
import { AppText } from './app-text';

type ScreenShellProps = PropsWithChildren<{
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}>;

export function ScreenShell({
  eyebrow,
  title,
  description,
  children,
}: ScreenShellProps) {
  const theme = useAppTheme();

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <AppText variant="eyebrow" tone="accent">
              {eyebrow}
            </AppText>
            <AppText variant="hero">{title}</AppText>
            <AppText tone="muted">{description}</AppText>
          </View>
          <View style={styles.content}>{children}</View>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: designSystemTokens.layout.maxContentWidth,
    paddingHorizontal: designSystemTokens.spacing[5],
    paddingTop: designSystemTokens.spacing[6],
    paddingBottom: designSystemTokens.spacing[8],
    gap: designSystemTokens.spacing[6],
  },
  header: {
    gap: designSystemTokens.spacing[3],
  },
  content: {
    gap: designSystemTokens.spacing[4],
  },
});
