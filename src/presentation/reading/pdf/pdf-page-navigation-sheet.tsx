import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  PdfPageThumbnail,
  PdfPageThumbnailProvider,
  PdfPageThumbnailProviderFactory,
  ReaderTableOfContentsEntry,
} from '@/application';
import { designSystemTokens, readingThemes } from '@/shared/theme';

import { AppText } from '../../components/app-text';
import { getPdfNavigationGridMetrics } from './pdf-reader-model';

const PDF_READING_THEME = 'paper' as const;

interface PdfPageNavigationSheetProps {
  readonly createThumbnailProvider: PdfPageThumbnailProviderFactory;
  readonly currentPage: number;
  readonly onClose: () => void;
  readonly onSelectOutlineEntry: (entryId: string) => void;
  readonly onSelectPage: (page: number) => void;
  readonly outlineEntries: readonly ReaderTableOfContentsEntry[];
  readonly sourceUri: string;
  readonly totalPages: number;
}

export function PdfPageNavigationSheet({
  createThumbnailProvider,
  currentPage,
  onClose,
  onSelectOutlineEntry,
  onSelectPage,
  outlineEntries,
  sourceUri,
  totalPages,
}: PdfPageNavigationSheetProps) {
  const [provider] = useState(createThumbnailProvider);
  const [providerStatus, setProviderStatus] = useState<
    'opening' | 'ready' | 'failure'
  >('opening');
  const window = useWindowDimensions();
  const metrics = getPdfNavigationGridMetrics(window.width);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  const theme = readingThemes[PDF_READING_THEME];

  useEffect(() => {
    let active = true;
    void provider.open(sourceUri, totalPages).then((opened) => {
      if (active) {
        setProviderStatus(opened.ok ? 'ready' : 'failure');
      }
    });
    return () => {
      active = false;
      void provider.close();
    };
  }, [provider, sourceUri, totalPages]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible>
      <SafeAreaView
        accessibilityViewIsModal
        edges={['top', 'bottom', 'left', 'right']}
        style={[styles.screen, { backgroundColor: theme.background }]}>
        <View style={[styles.content, { maxWidth: metrics.contentWidth }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.heading}>
              <AppText
                style={[styles.mutedText, { color: theme.text }]}
                variant="eyebrow">
                Navigation
              </AppText>
              <AppText style={{ color: theme.text }} variant="screenTitle">
                Pages du document
              </AppText>
            </View>
            <Pressable
              accessibilityLabel="Fermer la navigation"
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
            key={`pdf-pages-${metrics.columns}`}
            columnWrapperStyle={{ gap: metrics.gap }}
            contentContainerStyle={{
              gap: metrics.gap,
              padding: metrics.horizontalPadding,
            }}
            data={pages}
            keyExtractor={(page) => String(page)}
            ListHeaderComponent={
              <NavigationHeader
                outlineEntries={outlineEntries}
                onSelectOutlineEntry={onSelectOutlineEntry}
                providerStatus={providerStatus}
              />
            }
            ListHeaderComponentStyle={styles.navigationHeader}
            numColumns={metrics.columns}
            renderItem={({ item: page }) => (
              <PdfPageThumbnailButton
                current={page === currentPage}
                onSelectPage={onSelectPage}
                page={page}
                provider={provider}
                providerReady={providerStatus === 'ready'}
                width={metrics.itemWidth}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface NavigationHeaderProps {
  readonly onSelectOutlineEntry: (entryId: string) => void;
  readonly outlineEntries: readonly ReaderTableOfContentsEntry[];
  readonly providerStatus: 'opening' | 'ready' | 'failure';
}

function NavigationHeader({
  onSelectOutlineEntry,
  outlineEntries,
  providerStatus,
}: NavigationHeaderProps) {
  const theme = readingThemes[PDF_READING_THEME];
  return (
    <View style={styles.navigationHeaderContent}>
      {outlineEntries.length > 0 ? (
        <View style={styles.outlineSection}>
          <AppText style={{ color: theme.text }} variant="label">
            Sommaire
          </AppText>
          <FlatList
            data={outlineEntries}
            horizontal
            keyExtractor={(entry) => entry.id}
            renderItem={({ item }) => (
              <OutlineButton
                entry={item}
                onSelectOutlineEntry={onSelectOutlineEntry}
              />
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      ) : null}
      {providerStatus !== 'ready' ? (
        <View accessibilityLiveRegion="polite" style={styles.providerStatus}>
          {providerStatus === 'opening' ? (
            <ActivityIndicator color={theme.accent} size="small" />
          ) : null}
          <AppText
            style={[styles.mutedText, { color: theme.text }]}
            variant="caption">
            {providerStatus === 'opening'
              ? 'Préparation des aperçus…'
              : 'Aperçus indisponibles. Les pages restent accessibles.'}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function OutlineButton({
  entry,
  onSelectOutlineEntry,
}: {
  readonly entry: ReaderTableOfContentsEntry;
  readonly onSelectOutlineEntry: (entryId: string) => void;
}) {
  const theme = readingThemes[PDF_READING_THEME];
  const indent =
    Math.min(
      entry.depth,
      designSystemTokens.components.pdfPageNavigation.outlineIndentLimit,
    ) * designSystemTokens.spacing[2];
  return (
    <Pressable
      accessibilityHint="Navigue vers cette section"
      accessibilityLabel={entry.label}
      accessibilityRole="button"
      onPress={() => onSelectOutlineEntry(entry.id)}
      style={({ pressed }) => [
        styles.outlineButton,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          marginLeft: indent,
        },
        pressed && styles.pressed,
      ]}>
      <AppText numberOfLines={1} style={{ color: theme.text }} variant="caption">
        {entry.label}
      </AppText>
    </Pressable>
  );
}

interface PdfPageThumbnailButtonProps {
  readonly current: boolean;
  readonly onSelectPage: (page: number) => void;
  readonly page: number;
  readonly provider: PdfPageThumbnailProvider;
  readonly providerReady: boolean;
  readonly width: number;
}

function PdfPageThumbnailButton({
  current,
  onSelectPage,
  page,
  provider,
  providerReady,
  width,
}: PdfPageThumbnailButtonProps) {
  const [thumbnail, setThumbnail] = useState<
    PdfPageThumbnail | 'loading' | 'failure'
  >('loading');
  const theme = readingThemes[PDF_READING_THEME];

  useEffect(() => {
    if (!providerReady) {
      return;
    }
    let active = true;
    void provider.render(page).then((rendered) => {
      if (active) {
        setThumbnail(rendered.ok ? rendered.value : 'failure');
      }
    });
    return () => {
      active = false;
    };
  }, [page, provider, providerReady]);

  return (
    <Pressable
      accessibilityHint="Navigue directement vers cette page"
      accessibilityLabel={`Page ${page}`}
      accessibilityRole="button"
      accessibilityState={{ selected: current }}
      onPress={() => onSelectPage(page)}
      style={({ pressed }) => [
        styles.pageButton,
        { width },
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.thumbnailFrame,
          {
            backgroundColor: theme.surface,
            borderColor: current ? theme.accent : theme.border,
            borderWidth: current
              ? designSystemTokens.components.pdfPageNavigation
                  .selectedBorderWidth
              : designSystemTokens.components.pdfPageNavigation
                  .thumbnailBorderWidth,
          },
        ]}>
        {typeof thumbnail === 'object' ? (
          <Image
            accessibilityIgnoresInvertColors
            contentFit="contain"
            source={thumbnail.uri}
            style={StyleSheet.absoluteFill}
          />
        ) : thumbnail === 'loading' && providerReady ? (
          <ActivityIndicator color={theme.accent} size="small" />
        ) : (
          <AppText
            style={[styles.placeholderText, { color: theme.text }]}
            variant="caption">
            Aperçu indisponible
          </AppText>
        )}
      </View>
      <AppText
        numberOfLines={1}
        style={{ color: current ? theme.accent : theme.text }}
        variant="folio">
        {page}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
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
  navigationHeader: {
    marginBottom: designSystemTokens.spacing[2],
  },
  navigationHeaderContent: {
    gap: designSystemTokens.spacing[3],
  },
  outlineSection: {
    gap: designSystemTokens.spacing[2],
  },
  outlineButton: {
    maxHeight: designSystemTokens.components.pdfPageNavigation.outlineMaxHeight,
    marginRight: designSystemTokens.spacing[2],
    paddingHorizontal: designSystemTokens.spacing[3],
    paddingVertical: designSystemTokens.spacing[2],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: designSystemTokens.radii.pill,
  },
  providerStatus: {
    minHeight: designSystemTokens.spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    gap: designSystemTokens.spacing[2],
  },
  pageButton: {
    alignItems: 'center',
    gap: designSystemTokens.spacing[2],
  },
  thumbnailFrame: {
    width: '100%',
    aspectRatio: designSystemTokens.layout.pdfNavigationGrid.pageAspectRatio,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.sm,
  },
  placeholderText: {
    padding: designSystemTokens.spacing[2],
    textAlign: 'center',
    opacity:
      designSystemTokens.components.pdfPageNavigation
        .thumbnailPlaceholderOpacity,
  },
  pressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
  mutedText: {
    opacity: designSystemTokens.components.readerChrome.mutedOpacity,
  },
});
