import { Pressable, StyleSheet, View } from 'react-native';

import type { ReadingDirection } from '@/domain';
import {
  designSystemTokens,
  readingThemes,
  type ReadingThemeName,
} from '@/shared/theme';

import { AppText } from '../../components/app-text';

const options: readonly {
  readonly direction: ReadingDirection;
  readonly label: string;
  readonly shortLabel: string;
}[] = [
  {
    direction: 'left-to-right',
    label: 'Gauche vers droite',
    shortLabel: 'G > D',
  },
  {
    direction: 'right-to-left',
    label: 'Droite vers gauche',
    shortLabel: 'D > G',
  },
];

interface ImageReadingDirectionControlProps {
  readonly direction: ReadingDirection;
  readonly disabled: boolean;
  readonly onSelect: (direction: ReadingDirection) => void;
  readonly themeName: ReadingThemeName;
}

export function ImageReadingDirectionControl({
  direction,
  disabled,
  onSelect,
  themeName,
}: ImageReadingDirectionControlProps) {
  const theme = readingThemes[themeName];

  return (
    <View
      accessibilityLabel="Sens de lecture"
      accessibilityRole="radiogroup"
      style={styles.options}>
      {options.map((option) => {
        const selected = option.direction === direction;
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            key={option.direction}
            onPress={() => onSelect(option.direction)}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: selected ? theme.accent : theme.surface,
                borderColor: selected ? theme.accent : theme.border,
              },
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}>
            <AppText
              style={{ color: selected ? theme.background : theme.text }}
              variant="button">
              {option.shortLabel}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    flexDirection: 'row',
    gap: designSystemTokens.spacing[2],
  },
  option: {
    minHeight: designSystemTokens.components.readerSettingsSheet.touchTargetSize,
    minWidth: designSystemTokens.spacing[8],
    paddingHorizontal: designSystemTokens.spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
  disabled: {
    opacity: designSystemTokens.interaction.disabledOpacity,
  },
});
