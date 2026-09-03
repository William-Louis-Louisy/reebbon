import { Pressable, StyleSheet, View } from 'react-native';

import type { AppColorScheme } from '@/domain';
import { designSystemTokens } from '@/shared/theme';

import {
  useAppColorSchemePreference,
} from '../hooks/use-app-color-scheme';
import { useAppTheme } from '../hooks/use-app-theme';
import { AppText } from './app-text';

const options: readonly {
  readonly label: string;
  readonly value: AppColorScheme;
}[] = [
  { label: 'Claire', value: 'light' },
  { label: 'Sombre', value: 'dark' },
];

export function AppColorSchemeControl() {
  const theme = useAppTheme();
  const { colorScheme, isPersisting, selectColorScheme } =
    useAppColorSchemePreference();

  return (
    <View style={styles.container}>
      <AppText variant="eyebrow">Apparence</AppText>
      <View
        accessibilityLabel="Apparence de l’interface"
        accessibilityRole="radiogroup"
        style={[
          styles.options,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        {options.map((option) => {
          const selected = option.value === colorScheme;

          return (
            <Pressable
              accessibilityLabel={`Interface ${option.label.toLowerCase()}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, busy: isPersisting }}
              key={option.value}
              onPress={() => selectColorScheme(option.value)}
              style={({ pressed }) => [
                styles.option,
                selected && { backgroundColor: theme.text },
                pressed && styles.pressed,
              ]}>
              <AppText
                style={{ color: selected ? theme.background : theme.text }}
                variant="button">
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    gap: designSystemTokens.spacing[2],
    marginTop: designSystemTokens.spacing[2],
  },
  options: {
    flexDirection: 'row',
    borderWidth: designSystemTokens.components.appColorSchemeControl.borderWidth,
    borderRadius: designSystemTokens.radii.md,
    padding: designSystemTokens.spacing[1],
    gap: designSystemTokens.spacing[1],
  },
  option: {
    minWidth: designSystemTokens.components.appColorSchemeControl.optionMinWidth,
    minHeight: designSystemTokens.components.appColorSchemeControl.touchTargetSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.sm,
    paddingHorizontal: designSystemTokens.spacing[3],
  },
  pressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
  },
});
