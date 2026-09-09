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
import type { Book } from '@/domain';
import { designSystemTokens } from '@/shared/theme';

import { AppText } from '../../components/app-text';
import { AppColorSchemeControl } from '../../components/app-color-scheme-control';
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
  readonly onFileImportPress: () => void;
  readonly onImageDirectoryImportPress: () => void;
  readonly onBookPress: (book: Book) => void;
  readonly onRetryPress: () => void;
}

export default function LibraryScreen({
  state,
  isImporting,
  onBookPress,
  onFileImportPress,
  onImageDirectoryImportPress,
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
              onFileImportPress={onFileImportPress}
              onImageDirectoryImportPress={onImageDirectoryImportPress}
              onRetryPress={onRetryPress}
              isImporting={isImporting}
              status={state.status}
            />
          }
          ListHeaderComponent={
            <LibraryHeader
              isImporting={isImporting}
              onFileImportPress={onFileImportPress}
              onImageDirectoryImportPress={onImageDirectoryImportPress}
              showImportAction={books.length > 0}
            />
          }
          ListHeaderComponentStyle={styles.headerSpacing}
          numColumns={metrics.columns}
          renderItem={({ item }) => (
            <BookCard
              item={item}
              onBookPress={onBookPress}
              width={metrics.itemWidth}
            />
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
  readonly onFileImportPress: () => void;
  readonly onImageDirectoryImportPress: () => void;
  readonly showImportAction: boolean;
}

function LibraryHeader({
  isImporting,
  onFileImportPress,
  onImageDirectoryImportPress,
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
      <AppColorSchemeControl />
      {isImporting ? <ImportRibbonFeedback /> : null}
      {showImportAction ? (
        <ImportActions
          isImporting={isImporting}
          onFileImportPress={onFileImportPress}
          onImageDirectoryImportPress={onImageDirectoryImportPress}
        />
      ) : null}
    </View>
  );
}

function ImportRibbonFeedback() {
  return (
    <View accessibilityLiveRegion="polite" style={styles.importFeedback}>
      <View style={styles.importRibbonFrame}>
        <Ribbon animateUnfurl progress={1} />
      </View>
      <AppText tone="muted">Le Ruban se déroule pendant l’import…</AppText>
    </View>
  );
}

interface LibraryStatusProps {
  readonly status: LibraryScreenState['status'];
  readonly isImporting: boolean;
  readonly onFileImportPress: () => void;
  readonly onImageDirectoryImportPress: () => void;
  readonly onRetryPress: () => void;
}

function LibraryStatus({
  status,
  isImporting,
  onFileImportPress,
  onImageDirectoryImportPress,
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
        Importez un fichier EPUB, PDF, CBZ ou un dossier d’images pour composer
        votre bibliothèque hors ligne.
      </AppText>
      <ImportActions
        isImporting={isImporting}
        onFileImportPress={onFileImportPress}
        onImageDirectoryImportPress={onImageDirectoryImportPress}
      />
    </View>
  );
}

interface ImportActionsProps {
  readonly isImporting: boolean;
  readonly onFileImportPress: () => void;
  readonly onImageDirectoryImportPress: () => void;
}

function ImportActions({
  isImporting,
  onFileImportPress,
  onImageDirectoryImportPress,
}: ImportActionsProps) {
  return (
    <View style={styles.importActions}>
      <LibraryAction
        disabled={isImporting}
        label={isImporting ? 'Import en cours…' : 'Importer un fichier'}
        onPress={onFileImportPress}
      />
      <LibraryAction
        disabled={isImporting}
        label="Importer un dossier d’images"
        onPress={onImageDirectoryImportPress}
        variant="secondary"
      />
    </View>
  );
}

interface LibraryActionProps {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'primary' | 'secondary';
}

function LibraryAction({
  disabled = false,
  label,
  onPress,
  variant = 'primary',
}: LibraryActionProps) {
  const theme = useAppTheme();
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: disabled, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: primary ? theme.text : 'transparent',
          borderColor: theme.text,
        },
        !primary && styles.secondaryAction,
        pressed && styles.actionPressed,
        disabled && styles.actionDisabled,
      ]}>
      <AppText
        style={{ color: primary ? theme.background : theme.text }}
        variant="button">
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
  importFeedback: {
    minHeight: designSystemTokens.components.ribbon.maxHeight,
    marginTop: designSystemTokens.spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: designSystemTokens.spacing[3],
  },
  importRibbonFrame: {
    width: designSystemTokens.components.ribbon.width,
    height: designSystemTokens.components.ribbon.maxHeight,
  },
  importActions: {
    alignItems: 'flex-start',
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
  secondaryAction: {
    borderWidth: designSystemTokens.components.libraryImportAction.borderWidth,
  },
  actionPressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
  actionDisabled: {
    opacity: designSystemTokens.interaction.disabledOpacity,
  },
});
