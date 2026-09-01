import { Text, type TextProps, StyleSheet } from 'react-native';

import { designSystemTokens } from '@/shared/theme';
import { offlineFontFamilies } from '@/shared/theme/fonts';

import { useAppTheme } from '../hooks/use-app-theme';

export type AppTextVariant =
  | 'hero'
  | 'heading'
  | 'quote'
  | 'screenTitle'
  | 'label'
  | 'button'
  | 'body'
  | 'caption'
  | 'eyebrow'
  | 'folio'
  | 'reading';

export type AppTextTone = 'default' | 'muted' | 'accent';

export type AppTextProps = TextProps & {
  readonly variant?: AppTextVariant;
  readonly tone?: AppTextTone;
};

export function AppText({
  style,
  variant = 'body',
  tone = 'default',
  ...rest
}: AppTextProps) {
  const theme = useAppTheme();

  return (
    <Text
      style={[
        styles.base,
        { color: resolveTone(theme, tone) },
        variant === 'hero' && styles.hero,
        variant === 'heading' && styles.heading,
        variant === 'quote' && styles.quote,
        variant === 'screenTitle' && styles.screenTitle,
        variant === 'label' && styles.label,
        variant === 'button' && styles.button,
        variant === 'body' && styles.body,
        variant === 'caption' && styles.caption,
        variant === 'eyebrow' && styles.eyebrow,
        variant === 'folio' && styles.folio,
        variant === 'reading' && styles.reading,
        style,
      ]}
      {...rest}
    />
  );
}

function resolveTone(
  theme: ReturnType<typeof useAppTheme>,
  tone: AppTextTone,
) {
  if (tone === 'muted') {
    return theme.textMuted;
  }

  if (tone === 'accent') {
    return theme.accent;
  }

  return theme.text;
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
  hero: {
    fontFamily: offlineFontFamilies.displaySemiBold,
    fontSize: designSystemTokens.typography.roles.hero.size,
    lineHeight: designSystemTokens.typography.roles.hero.lineHeight,
    letterSpacing: designSystemTokens.typography.roles.hero.tracking,
  },
  heading: {
    fontFamily: offlineFontFamilies.displayMedium,
    fontSize: designSystemTokens.typography.roles.heading.size,
    lineHeight: designSystemTokens.typography.roles.heading.lineHeight,
    letterSpacing: designSystemTokens.typography.roles.heading.tracking,
  },
  quote: {
    fontFamily: offlineFontFamilies.displayItalic,
    fontSize: designSystemTokens.typography.roles.quote.size,
    lineHeight: designSystemTokens.typography.roles.quote.lineHeight,
    letterSpacing: designSystemTokens.typography.roles.quote.tracking,
  },
  screenTitle: {
    fontFamily: offlineFontFamilies.uiSemiBold,
    fontSize: designSystemTokens.typography.roles.screenTitle.size,
    lineHeight: designSystemTokens.typography.roles.screenTitle.lineHeight,
    letterSpacing: designSystemTokens.typography.roles.screenTitle.tracking,
  },
  label: {
    fontFamily: offlineFontFamilies.uiMedium,
    fontSize: designSystemTokens.typography.roles.label.size,
    lineHeight: designSystemTokens.typography.roles.label.lineHeight,
    letterSpacing: designSystemTokens.typography.roles.label.tracking,
  },
  button: {
    fontFamily: offlineFontFamilies.uiSemiBold,
    fontSize: designSystemTokens.typography.roles.button.size,
    lineHeight: designSystemTokens.typography.roles.button.lineHeight,
    letterSpacing: designSystemTokens.typography.roles.button.tracking,
  },
  body: {
    fontFamily: offlineFontFamilies.uiRegular,
    fontSize: designSystemTokens.typography.roles.body.size,
    lineHeight: designSystemTokens.typography.roles.body.lineHeight,
    letterSpacing: designSystemTokens.typography.roles.body.tracking,
  },
  caption: {
    fontFamily: offlineFontFamilies.uiRegular,
    fontSize: designSystemTokens.typography.roles.caption.size,
    lineHeight: designSystemTokens.typography.roles.caption.lineHeight,
    letterSpacing: designSystemTokens.typography.roles.caption.tracking,
  },
  eyebrow: {
    fontFamily: offlineFontFamilies.monoMedium,
    fontSize: designSystemTokens.typography.roles.eyebrow.size,
    lineHeight: designSystemTokens.typography.roles.eyebrow.lineHeight,
    letterSpacing: designSystemTokens.typography.roles.eyebrow.tracking,
    textTransform: 'uppercase',
  },
  folio: {
    fontFamily: offlineFontFamilies.monoRegular,
    fontSize: designSystemTokens.typography.roles.folio.size,
    lineHeight: designSystemTokens.typography.roles.folio.lineHeight,
    letterSpacing: designSystemTokens.typography.roles.folio.tracking,
  },
  reading: {
    fontFamily: offlineFontFamilies.readingRegular,
    fontSize: designSystemTokens.typography.roles.reading.size,
    lineHeight: designSystemTokens.typography.roles.reading.lineHeight,
    letterSpacing: designSystemTokens.typography.roles.reading.tracking,
  },
});
