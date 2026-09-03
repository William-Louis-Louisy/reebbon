import { Pressable, StyleSheet, View } from 'react-native';

import {
  readerHorizontalMarginOptions,
  readerLineSpacingOptions,
  type ReaderHorizontalMargin,
  type ReaderLineSpacing,
} from '@/domain';
import {
  designSystemTokens,
  readingThemes,
  type ReadingThemeName,
} from '@/shared/theme';

import { AppText } from '../../components/app-text';

interface EpubLayoutControlProps {
  readonly disabled: boolean;
  readonly horizontalMargin: ReaderHorizontalMargin;
  readonly lineSpacing: ReaderLineSpacing;
  readonly onHorizontalMarginChange: (margin: ReaderHorizontalMargin) => void;
  readonly onLineSpacingChange: (lineSpacing: ReaderLineSpacing) => void;
  readonly themeName: ReadingThemeName;
}

export function EpubLayoutControl({
  disabled,
  horizontalMargin,
  lineSpacing,
  onHorizontalMarginChange,
  onLineSpacingChange,
  themeName,
}: EpubLayoutControlProps) {
  return (
    <View style={styles.container}>
      <View
        accessibilityLabel="Interligne"
        accessibilityRole="radiogroup"
        style={styles.row}>
        <SettingLabel label="Interligne" themeName={themeName} />
        {readerLineSpacingOptions.map((option) => (
          <LayoutOption
            accessibilityLabel={`Interligne ${String(option).replace('.', ',')}`}
            disabled={disabled}
            key={option}
            label={String(option).replace('.', ',')}
            onPress={() => onLineSpacingChange(option)}
            selected={option === lineSpacing}
            themeName={themeName}
          />
        ))}
      </View>
      <View
        accessibilityLabel="Marges horizontales"
        accessibilityRole="radiogroup"
        style={styles.row}>
        <SettingLabel label="Marges" themeName={themeName} />
        {readerHorizontalMarginOptions.map((option) => (
          <LayoutOption
            accessibilityLabel={`Marges horizontales ${option} pixels`}
            disabled={disabled}
            key={option}
            label={String(option)}
            onPress={() => onHorizontalMarginChange(option)}
            selected={option === horizontalMargin}
            themeName={themeName}
          />
        ))}
      </View>
    </View>
  );
}

interface SettingLabelProps {
  readonly label: string;
  readonly themeName: ReadingThemeName;
}

function SettingLabel({ label, themeName }: SettingLabelProps) {
  return (
    <AppText
      numberOfLines={1}
      style={[styles.label, { color: readingThemes[themeName].text }]}
      variant="eyebrow">
      {label}
    </AppText>
  );
}

interface LayoutOptionProps {
  readonly accessibilityLabel: string;
  readonly disabled: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly selected: boolean;
  readonly themeName: ReadingThemeName;
}

function LayoutOption({
  accessibilityLabel,
  disabled,
  label,
  onPress,
  selected,
  themeName,
}: LayoutOptionProps) {
  const theme = readingThemes[themeName];
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radio"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.touchTarget,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <View
        style={[
          styles.option,
          {
            backgroundColor: theme.surface,
            borderColor: selected ? theme.accent : theme.border,
          },
          selected && styles.selected,
        ]}>
        <AppText style={{ color: theme.text }} variant="folio">
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const controlTokens = designSystemTokens.components.readingLayoutControl;

const styles = StyleSheet.create({
  container: {
    gap: designSystemTokens.spacing[1],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    minWidth: controlTokens.labelMinWidth,
  },
  touchTarget: {
    width: controlTokens.touchTargetSize,
    height: controlTokens.touchTargetSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.sm,
  },
  option: {
    width: controlTokens.optionWidth,
    height: controlTokens.optionHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: designSystemTokens.radii.sm,
  },
  selected: {
    borderWidth: controlTokens.selectedBorderWidth,
  },
  pressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
  disabled: {
    opacity: designSystemTokens.interaction.disabledOpacity,
  },
});
