import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LibraryBookItem } from '@/application';
import { designSystemTokens } from '@/shared/theme';

import { AppText } from '../../components/app-text';
import { BookCard } from '../../components/book-card';
import { Ribbon } from '../../components/ribbon';
import { useAppTheme } from '../../hooks/use-app-theme';
import { getLibraryGridMetrics } from './library-layout';

export type LibraryScreenState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly books: readonly LibraryBookItem[] }
  | { readonly status: 'failure' };

export interface LibraryScreenProps {
  readonly state: LibraryScreenState;
  readonly isImporting: boolean;
  readonly onImportPress: () => void;
  readonly onRetryPress: () => void;
}

export default function LibraryScreen({
  state,
  isImporting,
  onImportPress,
  onRetryPress,
}: LibraryScreenProps) {
  const theme = useAppTheme();
  const window = useWindowDimensions();
  const metrics = getLibraryGridMetrics(window.width);
  const books = state.status === 'ready' ? state.books : [];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <FlatList
          key={`library-${metrics.columns}`}
          columnWrapperStyle={{ gap: metrics.gap }}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                designSystemTokens.layout.libraryGrid.navigationClearance,
              paddingHorizontal: metrics.horizontalPadding,
            },
          ]}
          data={books}
          keyExtractor={(item) => item.book.id}
          ListEmptyComponent={
            <LibraryStatus
              onImportPress={onImportPress}
              onRetryPress={onRetryPress}
              isImporting={isImporting}
              status={state.status}
            />
          }
          ListHeaderComponent={
            <LibraryHeader
              isImporting={isImporting}
              onImportPress={onImportPress}
              showImportAction={books.length > 0}
            />
          }
          ListHeaderComponentStyle={styles.headerSpacing}
          numColumns={metrics.columns}
          renderItem={({ item }) => (
            <BookCard item={item} width={metrics.itemWidth} />
          )}
          showsVerticalScrollIndicator={false}
          style={[styles.list, { maxWidth: metrics.contentWidth }]}
        />
      </SafeAreaView>
    </View>
  );
}

interface LibraryHeaderProps {
  readonly isImporting: boolean;
  readonly onImportPress: () => void;
  readonly showImportAction: boolean;
}

function LibraryHeader({
  isImporting,
  onImportPress,
  showImportAction,
}: LibraryHeaderProps) {
  return (
    <View style={styles.header}>
      <AppText tone="accent" variant="eyebrow">
        Reebbon · bibliothèque
      </AppText>
      <AppText variant="screenTitle">Ma bibliothèque</AppText>
      <AppText tone="muted">
        Vos ouvrages, leur couverture et votre progression réunis au même endroit.
      </AppText>
      {showImportAction ? (
        <LibraryAction
          disabled={isImporting}
          label={isImporting ? 'Import en cours…' : 'Importer un EPUB'}
          onPress={onImportPress}
        />
      ) : null}
    </View>
  );
}

interface LibraryStatusProps {
  readonly status: LibraryScreenState['status'];
  readonly isImporting: boolean;
  readonly onImportPress: () => void;
  readonly onRetryPress: () => void;
}

function LibraryStatus({
  status,
  isImporting,
  onImportPress,
  onRetryPress,
}: LibraryStatusProps) {
  const theme = useAppTheme();

  if (status === 'loading') {
    return (
      <View accessibilityLiveRegion="polite" style={styles.statusPanel}>
        <ActivityIndicator color={theme.accent} />
        <AppText tone="muted">Chargement de la bibliothèque…</AppText>
      </View>
    );
  }

  if (status === 'failure') {
    return (
      <View accessibilityLiveRegion="assertive" style={styles.statusPanel}>
        <AppText variant="quote">La bibliothèque ne répond pas.</AppText>
        <AppText style={styles.statusCopy} tone="muted">
          Les ouvrages sont restés sur cet appareil. Réessayez d’ouvrir le stockage local.
        </AppText>
        <LibraryAction label="Réessayer" onPress={onRetryPress} />
      </View>
    );
  }

  return (
    <View style={styles.statusPanel}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.emptyBook,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        <Ribbon progress={0} style={styles.emptyRibbon} />
      </View>
      <AppText style={styles.statusCopy} variant="quote">
        Votre prochaine lecture commence ici.
      </AppText>
      <AppText style={styles.statusCopy} tone="muted">
        Importez un fichier EPUB pour composer votre bibliothèque hors ligne.
      </AppText>
      <LibraryAction
        disabled={isImporting}
        label={isImporting ? 'Import en cours…' : 'Importer un EPUB'}
        onPress={onImportPress}
      />
    </View>
  );
}

interface LibraryActionProps {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
}

function LibraryAction({ disabled = false, label, onPress }: LibraryActionProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: disabled, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: theme.text },
        pressed && styles.actionPressed,
        disabled && styles.actionDisabled,
      ]}>
      <AppText style={{ color: theme.background }} variant="button">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  list: {
    width: '100%',
  },
  content: {
    flexGrow: 1,
    rowGap: designSystemTokens.spacing[5],
    paddingTop: designSystemTokens.spacing[6],
  },
  headerSpacing: {
    marginBottom: designSystemTokens.spacing[6],
  },
  header: {
    gap: designSystemTokens.spacing[2],
  },
  statusPanel: {
    minHeight: designSystemTokens.layout.libraryGrid.emptyStateMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: designSystemTokens.spacing[3],
    paddingVertical: designSystemTokens.spacing[7],
  },
  statusCopy: {
    maxWidth: designSystemTokens.spacing[8] * 5,
    textAlign: 'center',
  },
  emptyBook: {
    width: designSystemTokens.layout.libraryGrid.emptyBookWidth,
    height: designSystemTokens.layout.libraryGrid.emptyBookHeight,
    marginBottom: designSystemTokens.spacing[3],
    borderWidth: 1,
    borderRadius: designSystemTokens.radii.md,
    ...designSystemTokens.shadows.bookCover,
  },
  emptyRibbon: {
    position: 'absolute',
    right: designSystemTokens.components.ribbon.coverInset,
    top: 0,
  },
  action: {
    minHeight: designSystemTokens.spacing[7],
    marginTop: designSystemTokens.spacing[2],
    paddingHorizontal: designSystemTokens.spacing[5],
    paddingVertical: designSystemTokens.spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.sm,
  },
  actionPressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
  actionDisabled: {
    opacity: designSystemTokens.interaction.disabledOpacity,
  },
});
