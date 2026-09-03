import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ReaderTableOfContentsEntry } from '@/application';
import {
  designSystemTokens,
  readingThemes,
  type ReadingThemeName,
} from '@/shared/theme';

import { AppText } from '../../components/app-text';

interface EpubTableOfContentsSheetProps {
  readonly entries: readonly ReaderTableOfContentsEntry[];
  readonly onClose: () => void;
  readonly onSelect: (entryId: string) => void;
  readonly themeName: ReadingThemeName;
  readonly visible: boolean;
}

export function EpubTableOfContentsSheet({
  entries,
  onClose,
  onSelect,
  themeName,
  visible,
}: EpubTableOfContentsSheetProps) {
  const theme = readingThemes[themeName];
  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={visible}>
      <SafeAreaView
        accessibilityViewIsModal
        edges={['top', 'bottom', 'left', 'right']}
        style={[styles.screen, { backgroundColor: theme.background }]}>
        <View style={styles.content}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.heading}>
              <AppText
                style={[styles.mutedText, { color: theme.text }]}
                variant="eyebrow">
                Navigation
              </AppText>
              <AppText style={{ color: theme.text }} variant="screenTitle">
                Table des matières
              </AppText>
            </View>
            <Pressable
              accessibilityLabel="Fermer la table des matières"
              accessibilityRole="button"
              hitSlop={designSystemTokens.spacing[2]}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}>
              <AppText style={{ color: theme.text }} variant="button">
                Fermer
              </AppText>
            </Pressable>
          </View>

          <FlatList
            contentContainerStyle={styles.listContent}
            data={entries}
            keyExtractor={(entry) => entry.id}
            renderItem={({ item }) => (
              <TableOfContentsRow
                entry={item}
                onSelect={onSelect}
                themeName={themeName}
              />
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface TableOfContentsRowProps {
  readonly entry: ReaderTableOfContentsEntry;
  readonly onSelect: (entryId: string) => void;
  readonly themeName: ReadingThemeName;
}

function TableOfContentsRow({
  entry,
  onSelect,
  themeName,
}: TableOfContentsRowProps) {
  const theme = readingThemes[themeName];
  const indentation =
    designSystemTokens.spacing[4] +
    Math.min(entry.depth, 4) * designSystemTokens.spacing[4];

  return (
    <Pressable
      accessibilityHint="Navigue vers cette section"
      accessibilityLabel={entry.label}
      accessibilityRole="button"
      onPress={() => onSelect(entry.id)}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.border, paddingLeft: indentation },
        pressed && styles.pressed,
      ]}>
      <AppText
        style={{ color: theme.text }}
        variant={entry.depth === 0 ? 'label' : 'body'}>
        {entry.label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: designSystemTokens.layout.maxContentWidth,
    alignSelf: 'center',
  },
  header: {
    minHeight: designSystemTokens.spacing[8],
    paddingHorizontal: designSystemTokens.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: designSystemTokens.spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  heading: {
    flex: 1,
    gap: designSystemTokens.spacing[1],
  },
  closeButton: {
    minHeight: designSystemTokens.spacing[7],
    paddingHorizontal: designSystemTokens.spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.sm,
  },
  listContent: {
    paddingBottom: designSystemTokens.spacing[6],
  },
  row: {
    minHeight: designSystemTokens.spacing[7],
    paddingTop: designSystemTokens.spacing[3],
    paddingRight: designSystemTokens.spacing[4],
    paddingBottom: designSystemTokens.spacing[3],
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
  mutedText: {
    opacity: designSystemTokens.components.readerChrome.mutedOpacity,
  },
});
