import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { designSystemTokens, readingThemes, type ReadingThemeName } from '@/shared/theme';

import { AppText } from '../components/app-text';
import { Ribbon } from '../components/ribbon';

export interface ReaderFolio {
  readonly current: number;
  readonly total: number;
}

interface ReaderScreenChromeProps {
  readonly bookTitle: string;
  readonly children: ReactNode;
  readonly completionRatio: number;
  readonly folio?: ReaderFolio;
  readonly headerActions?: ReactNode;
  readonly isNextDisabled: boolean;
  readonly isPreviousDisabled: boolean;
  readonly onClose: () => void;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly themeName: ReadingThemeName;
}

export function ReaderScreenChrome({
  bookTitle,
  children,
  completionRatio,
  folio,
  headerActions,
  isNextDisabled,
  isPreviousDisabled,
  onClose,
  onNext,
  onPrevious,
  themeName,
}: ReaderScreenChromeProps) {
  const theme = readingThemes[themeName];
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        style={styles.safeArea}>
        <View style={styles.topBar}>
          <Ribbon progress={completionRatio} style={styles.readerRibbon} />
          <AppText
            numberOfLines={1}
            style={[styles.bookTitle, { color: theme.text }]}
            variant="eyebrow">
            {bookTitle}
          </AppText>
          {headerActions}
          <ReaderChromeButton
            color={theme.text}
            label="Fermer"
            onPress={onClose}
          />
        </View>

        <View style={styles.rendition}>{children}</View>

        <View style={styles.bottomBar}>
          <ReaderChromeButton
            color={theme.text}
            disabled={isPreviousDisabled}
            label="Page précédente"
            onPress={onPrevious}
            shortLabel="‹"
          />
          <View accessibilityLiveRegion="polite" style={styles.folio}>
            <AppText style={{ color: theme.text }} variant="folio">
              {folio === undefined ? '— / —' : `${folio.current} / ${folio.total}`}
            </AppText>
            <AppText
              style={[styles.mutedText, { color: theme.text }]}
              variant="folio">
              {Math.round(normalizeCompletionRatio(completionRatio) * 100)}%
            </AppText>
          </View>
          <ReaderChromeButton
            color={theme.text}
            disabled={isNextDisabled}
            label="Page suivante"
            onPress={onNext}
            shortLabel="›"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

interface ReaderLoadingProps {
  readonly label: string;
  readonly themeName: ReadingThemeName;
}

export function ReaderLoading({ label, themeName }: ReaderLoadingProps) {
  const theme = readingThemes[themeName];
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.overlay, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.accent} />
      <AppText style={[styles.mutedText, { color: theme.text }]}>
        {label}
      </AppText>
    </View>
  );
}

interface ReaderFailureProps {
  readonly message: string;
  readonly onClose: () => void;
  readonly onRetry: () => void;
  readonly themeName: ReadingThemeName;
  readonly title: string;
}

export function ReaderFailure({
  message,
  onClose,
  onRetry,
  themeName,
  title,
}: ReaderFailureProps) {
  const theme = readingThemes[themeName];
  return (
    <View
      accessibilityLiveRegion="assertive"
      style={[styles.overlay, { backgroundColor: theme.background }]}>
      <AppText style={{ color: theme.text }} variant="quote">
        {title}
      </AppText>
      <AppText
        style={[styles.failureCopy, styles.mutedText, { color: theme.text }]}>
        {message}
      </AppText>
      <View style={styles.failureActions}>
        <ReaderChromeButton color={theme.text} label="Fermer" onPress={onClose} />
        <ReaderChromeButton color={theme.text} label="Réessayer" onPress={onRetry} />
      </View>
    </View>
  );
}

interface ReaderChromeButtonProps {
  readonly color: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly shortLabel?: string;
}

export function ReaderChromeButton({
  color,
  disabled = false,
  label,
  onPress,
  shortLabel,
}: ReaderChromeButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={designSystemTokens.spacing[2]}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        pressed && styles.controlPressed,
        disabled && styles.controlDisabled,
      ]}>
      <AppText
        style={{ color }}
        variant={shortLabel === undefined ? 'button' : 'screenTitle'}>
        {shortLabel ?? label}
      </AppText>
    </Pressable>
  );
}

function normalizeCompletionRatio(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    minHeight: designSystemTokens.spacing[7],
    paddingHorizontal: designSystemTokens.spacing[4],
    paddingRight: designSystemTokens.spacing[8],
    flexDirection: 'row',
    alignItems: 'center',
    gap: designSystemTokens.spacing[3],
  },
  bookTitle: {
    flex: 1,
  },
  readerRibbon: {
    position: 'absolute',
    right: designSystemTokens.components.ribbon.coverInset,
    top: 0,
    zIndex: 1,
  },
  rendition: {
    flex: 1,
  },
  bottomBar: {
    minHeight: designSystemTokens.spacing[8],
    paddingHorizontal: designSystemTokens.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: designSystemTokens.spacing[2],
  },
  folio: {
    alignItems: 'center',
    gap: designSystemTokens.spacing[1],
  },
  control: {
    minWidth: designSystemTokens.spacing[7],
    minHeight: designSystemTokens.spacing[7],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.sm,
  },
  controlPressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
  controlDisabled: {
    opacity: designSystemTokens.interaction.disabledOpacity,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    padding: designSystemTokens.spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    gap: designSystemTokens.spacing[3],
  },
  failureCopy: {
    maxWidth: designSystemTokens.spacing[8] * 5,
    textAlign: 'center',
  },
  failureActions: {
    flexDirection: 'row',
    gap: designSystemTokens.spacing[3],
  },
  mutedText: {
    opacity: designSystemTokens.components.readerChrome.mutedOpacity,
  },
});
