import type { PropsWithChildren } from 'react';
import { View, StyleSheet } from 'react-native';

import { designSystemTokens } from '@/shared/theme';

import { useAppTheme } from '../hooks/use-app-theme';
import { AppText } from './app-text';

type SectionCardProps = PropsWithChildren<{
  readonly eyebrow?: string;
  readonly title?: string;
}>;

export function SectionCard({ eyebrow, title, children }: SectionCardProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}>
      {eyebrow ? <AppText variant="eyebrow" tone="accent">{eyebrow}</AppText> : null}
      {title ? <AppText variant="heading">{title}</AppText> : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: designSystemTokens.radii.lg,
    padding: designSystemTokens.spacing[5],
    gap: designSystemTokens.spacing[3],
  },
  content: {
    gap: designSystemTokens.spacing[3],
  },
});
