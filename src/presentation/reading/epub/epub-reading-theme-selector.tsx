import { Pressable, StyleSheet, View } from 'react-native';

import {
  designSystemTokens,
  readingThemes,
  type ReadingThemeName,
} from '@/shared/theme';

const themeOptions: readonly {
  readonly name: ReadingThemeName;
  readonly label: string;
}[] = [
  { name: 'paper', label: 'Paper' },
  { name: 'sepia', label: 'Sépia' },
  { name: 'night', label: 'Nuit' },
];

interface EpubReadingThemeSelectorProps {
  readonly disabled: boolean;
  readonly onSelect: (theme: ReadingThemeName) => void;
  readonly selectedTheme: ReadingThemeName;
}

export function EpubReadingThemeSelector({
  disabled,
  onSelect,
  selectedTheme,
}: EpubReadingThemeSelectorProps) {
  const activeTheme = readingThemes[selectedTheme];

  return (
    <View
      accessibilityLabel="Thème de lecture"
      accessibilityRole="radiogroup"
      style={styles.options}>
      {themeOptions.map((option) => {
        const selected = option.name === selectedTheme;
        return (
          <Pressable
            accessibilityLabel={`Thème ${option.label}`}
            accessibilityRole="radio"
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            hitSlop={designSystemTokens.spacing[2]}
            key={option.name}
            onPress={() => onSelect(option.name)}
            style={({ pressed }) => [
              styles.control,
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: readingThemes[option.name].background,
                  borderColor: selected ? activeTheme.accent : 'transparent',
                },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const selectorTokens = designSystemTokens.components.readingThemeSelector;

const styles = StyleSheet.create({
  options: {
    flexDirection: 'row',
    gap: designSystemTokens.spacing[1],
  },
  control: {
    width: selectorTokens.controlSize,
    height: selectorTokens.controlSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.pill,
  },
  dot: {
    width: selectorTokens.dotSize,
    height: selectorTokens.dotSize,
    borderWidth: selectorTokens.borderWidth,
    borderRadius: designSystemTokens.radii.pill,
  },
  pressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
  disabled: {
    opacity: designSystemTokens.interaction.disabledOpacity,
  },
});
