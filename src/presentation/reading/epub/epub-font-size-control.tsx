import { Pressable, StyleSheet, View } from 'react-native';

import {
  readerFontSizeRange,
  type ReaderFontSize,
} from '@/domain';
import {
  designSystemTokens,
  readingThemes,
  type ReadingThemeName,
} from '@/shared/theme';

import { AppText } from '../../components/app-text';

interface EpubFontSizeControlProps {
  readonly disabled: boolean;
  readonly fontSize: ReaderFontSize;
  readonly onDecrease: () => void;
  readonly onIncrease: () => void;
  readonly themeName: ReadingThemeName;
}

export function EpubFontSizeControl({
  disabled,
  fontSize,
  onDecrease,
  onIncrease,
  themeName,
}: EpubFontSizeControlProps) {
  const theme = readingThemes[themeName];
  const decreaseDisabled =
    disabled || fontSize <= readerFontSizeRange.minimum;
  const increaseDisabled =
    disabled || fontSize >= readerFontSizeRange.maximum;

  return (
    <View
      accessibilityLabel="Taille de police"
      accessibilityRole="toolbar"
      style={styles.container}>
      <FontSizeButton
        disabled={decreaseDisabled}
        label="Réduire la taille de police"
        onPress={onDecrease}
        symbol="−"
        themeName={themeName}
      />
      <AppText
        accessibilityLabel={'Taille de police ' + fontSize}
        accessibilityLiveRegion="polite"
        style={[styles.value, { color: theme.text }]}
        variant="folio">
        {fontSize}
      </AppText>
      <FontSizeButton
        disabled={increaseDisabled}
        label="Augmenter la taille de police"
        onPress={onIncrease}
        symbol="+"
        themeName={themeName}
      />
    </View>
  );
}

interface FontSizeButtonProps {
  readonly disabled: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly symbol: string;
  readonly themeName: ReadingThemeName;
}

function FontSizeButton({
  disabled,
  label,
  onPress,
  symbol,
  themeName,
}: FontSizeButtonProps) {
  const theme = readingThemes[themeName];
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <View
        style={[
          styles.buttonSurface,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}>
        <AppText style={{ color: theme.text }} variant="button">
          {symbol}
        </AppText>
      </View>
    </Pressable>
  );
}

const controlTokens =
  designSystemTokens.components.readingFontSizeControl;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: designSystemTokens.spacing[2],
  },
  button: {
    width: controlTokens.touchTargetSize,
    height: controlTokens.touchTargetSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.sm,
  },
  buttonSurface: {
    width: controlTokens.buttonSize,
    height: controlTokens.buttonSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: designSystemTokens.radii.sm,
  },
  value: {
    minWidth: controlTokens.valueMinWidth,
    textAlign: 'center',
  },
  pressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
  disabled: {
    opacity: designSystemTokens.interaction.disabledOpacity,
  },
});
