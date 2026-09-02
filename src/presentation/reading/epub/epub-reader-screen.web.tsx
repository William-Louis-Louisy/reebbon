import { Pressable, StyleSheet, View } from 'react-native';

import { designSystemTokens, readingThemes } from '@/shared/theme';

import { AppText } from '../../components/app-text';
import type { EpubReaderScreenProps } from './epub-reader-screen.types';

export default function EpubReaderScreen({
  book,
  onClose,
}: EpubReaderScreenProps) {
  return (
    <View style={styles.screen}>
      <AppText variant="screenTitle">{book.title}</AppText>
      <AppText style={styles.copy} tone="muted">
        La lecture EPUB WebView est disponible dans les applications iOS et Android.
      </AppText>
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <AppText variant="button">Fermer</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: designSystemTokens.spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    gap: designSystemTokens.spacing[3],
    backgroundColor: readingThemes.paper.background,
  },
  copy: {
    maxWidth: designSystemTokens.spacing[8] * 5,
    textAlign: 'center',
  },
  button: {
    minHeight: designSystemTokens.spacing[7],
    paddingHorizontal: designSystemTokens.spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.sm,
  },
  pressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
  },
});
