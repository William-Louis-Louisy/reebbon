import {
  Reader as CoreReader,
  ReaderProvider,
  useReader as useCoreReader,
  type Location as CoreLocation,
} from '@epubjs-react-native/core';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createEpubReader,
  type EpubRenditionError,
  type Reader,
  type ReaderTableOfContentsEntry,
} from '@/application';
import { designSystemTokens, readingThemes } from '@/shared/theme';

import { AppText } from '../../components/app-text';
import { EpubRenditionBridge } from './epub-rendition-bridge';
import { EpubTableOfContentsSheet } from './epub-table-of-contents-sheet';
import {
  createLiterataInjection,
  epubCoreThemes,
  getEpubFolio,
  parseEpubDisplayLocation,
  parseEpubTableOfContents,
} from './epub-reader-model';
import type { EpubReaderScreenProps } from './epub-reader-screen.types';

export default function EpubReaderScreen(props: EpubReaderScreenProps) {
  const [bridge] = useState(() => new EpubRenditionBridge());
  const [reader] = useState<Reader<'epub'>>(() => createEpubReader(bridge));

  return (
    <ReaderProvider>
      <EpubReaderSession {...props} bridge={bridge} reader={reader} />
    </ReaderProvider>
  );
}

interface EpubReaderSessionProps extends EpubReaderScreenProps {
  readonly bridge: EpubRenditionBridge;
  readonly reader: Reader<'epub'>;
}

function EpubReaderSession({
  book,
  bridge,
  clearRendererCache,
  fileSystem,
  initialPosition,
  loadReadingFont,
  onClose,
  onProgressChange,
  prepareSource,
  reader,
}: EpubReaderSessionProps) {
  const coreReader = useCoreReader();
  const { changeTheme, goNext, goPrevious, goToLocation } = coreReader;
  const snapshot = useSyncExternalStore(
    bridge.subscribe,
    bridge.getSnapshot,
    bridge.getSnapshot,
  );
  const [fontDataUri, setFontDataUri] = useState<string>();
  const [preparationError, setPreparationError] = useState<EpubRenditionError>();
  const [isPreparing, setIsPreparing] = useState(true);
  const [completionRatio, setCompletionRatio] = useState(0);
  const [tableOfContentsEntries, setTableOfContentsEntries] = useState<
    readonly ReaderTableOfContentsEntry[]
  >([]);
  const [isTableOfContentsVisible, setIsTableOfContentsVisible] = useState(false);
  const folio = getEpubFolio(snapshot.location);

  useEffect(() =>
    bridge.attachControls({
      goToLocation,
      goPrevious,
      goNext,
      changeTheme: (theme) => changeTheme(epubCoreThemes[theme]),
    }), [
    bridge,
    changeTheme,
    goNext,
    goPrevious,
    goToLocation,
  ]);

  useEffect(() => {
    let active = true;
    const opening = loadSessionResources(
      book.fileUri,
      prepareSource,
      loadReadingFont,
    ).then((resources) => {
      if (!active) {
        return;
      }
      setIsPreparing(false);
      if (!resources.ok) {
        setPreparationError(resources.error);
        return;
      }
      setFontDataUri(resources.fontDataUri);
      return reader.open(
        { ...book, fileUri: resources.sourceUri },
        initialPosition,
      );
    });

    return () => {
      active = false;
      void opening.finally(async () => {
        await reader.close();
        await clearRendererCache();
      });
    };
  }, [
    book,
    clearRendererCache,
    initialPosition,
    loadReadingFont,
    prepareSource,
    reader,
  ]);

  const updateProgress = () => {
    void reader.getProgress().then((progress) => {
      if (progress.ok) {
        setCompletionRatio(progress.value.completionRatio);
        onProgressChange(progress.value);
      }
    });
  };

  const updateTableOfContents = () => {
    void reader.tableOfContents?.getEntries().then((result) => {
      if (result.ok) {
        setTableOfContentsEntries(result.value);
      }
    });
  };

  const reportLocation = (
    totalLocations: number,
    location: CoreLocation,
    progress: number,
    unit: 'ratio' | 'percentage',
    ready: boolean,
  ) => {
    const parsed = parseEpubDisplayLocation(
      location,
      totalLocations,
      progress,
      unit,
    );
    if (!parsed.ok) {
      bridge.reportFailure({ kind: 'rendering-failure' });
      return;
    }
    if (ready) {
      bridge.reportReady(parsed.value);
      void reader.setTheme('paper');
    } else {
      bridge.reportLocation(parsed.value);
    }
    void Promise.resolve().then(() => {
      updateProgress();
      if (ready) {
        updateTableOfContents();
      }
    });
  };

  const selectTableOfContentsEntry = (entryId: string) => {
    void reader.tableOfContents?.goToEntry(entryId).then((result) => {
      if (result.ok) {
        setIsTableOfContentsVisible(false);
      }
    });
  };

  const close = () => {
    setIsTableOfContentsVisible(false);
    void reader.close().finally(onClose);
  };

  const retry = () => {
    setCompletionRatio(0);
    setTableOfContentsEntries([]);
    setIsTableOfContentsVisible(false);
    setFontDataUri(undefined);
    setPreparationError(undefined);
    setIsPreparing(true);
    void reader.close().then(async () => {
      await clearRendererCache();
      const resources = await loadSessionResources(
        book.fileUri,
        prepareSource,
        loadReadingFont,
      );
      setIsPreparing(false);
      if (!resources.ok) {
        setPreparationError(resources.error);
        return;
      }
      setFontDataUri(resources.fontDataUri);
      await reader.open(
        { ...book, fileUri: resources.sourceUri },
        initialPosition,
      );
    });
  };

  return (
    <>
      <View
        style={[
          styles.screen,
          { backgroundColor: readingThemes.paper.background },
        ]}>
        <SafeAreaView
          edges={['top', 'bottom', 'left', 'right']}
          style={styles.safeArea}>
          <View style={styles.topBar}>
            <AppText
              numberOfLines={1}
              style={[styles.bookTitle, styles.readerText]}
              variant="eyebrow">
              {book.title}
            </AppText>
            {tableOfContentsEntries.length > 0 ? (
              <ReaderButton
                label="Sommaire"
                onPress={() => setIsTableOfContentsVisible(true)}
              />
            ) : null}
            <ReaderButton label="Fermer" onPress={close} />
          </View>

          <View style={styles.rendition}>
            {snapshot.status === 'failure' || preparationError !== undefined ? (
              <ReaderFailure onClose={close} onRetry={retry} />
            ) : null}
            {snapshot.sourceUri !== undefined && fontDataUri !== undefined ? (
              <CoreReader
              key={snapshot.sessionId}
              allowPopups={false}
              allowScriptedContent={false}
              defaultTheme={epubCoreThemes.paper}
              enableSelection={false}
              enableSwipe
              fileSystem={fileSystem}
              flow="paginated"
              height="100%"
              initialLocation={snapshot.initialCfi}
              injectedJavascript={createLiterataInjection(fontDataUri)}
              manager="default"
              onDisplayError={() =>
                bridge.reportFailure({ kind: 'rendering-failure' })
              }
              onLocationChange={(total, location, progress) =>
                reportLocation(total, location, progress, 'percentage', false)
              }
              onNavigationLoaded={({ toc }) => {
                const parsed = parseEpubTableOfContents(toc);
                bridge.reportTableOfContents(
                  parsed.ok ? parsed.value.entries : [],
                  parsed.ok ? parsed.value.targets : {},
                );
                void Promise.resolve().then(updateTableOfContents);
              }}
              onLocationsReady={(_key, locations) => {
                const current = bridge.getSnapshot().location;
                if (current !== undefined) {
                  bridge.reportLocation({
                    ...current,
                    totalLocations: locations.length,
                  });
                }
              }}
              onReady={(total, location, progress) =>
                reportLocation(total, location, progress, 'ratio', true)
              }
              snap
              spread="none"
              src={snapshot.sourceUri}
              width="100%"
              />
            ) : null}
            {isPreparing || snapshot.status === 'opening' ? (
              <ReaderLoading />
            ) : null}
          </View>

          <View style={styles.bottomBar}>
            <ReaderButton
              disabled={snapshot.status !== 'ready'}
              label="Page précédente"
              onPress={() => bridge.previousPage()}
              shortLabel="‹"
            />
            <View accessibilityLiveRegion="polite" style={styles.folio}>
              <AppText style={styles.readerText} variant="folio">
                {folio === undefined
                  ? '— / —'
                  : `${folio.current} / ${folio.total}`}
              </AppText>
              <AppText style={styles.readerMutedText} variant="folio">
                {Math.round(completionRatio * 100)}%
              </AppText>
            </View>
            <ReaderButton
              disabled={snapshot.status !== 'ready'}
              label="Page suivante"
              onPress={() => bridge.nextPage()}
              shortLabel="›"
            />
          </View>
        </SafeAreaView>
      </View>
      <EpubTableOfContentsSheet
        entries={tableOfContentsEntries}
        onClose={() => setIsTableOfContentsVisible(false)}
        onSelect={selectTableOfContentsEntry}
        visible={isTableOfContentsVisible}
      />
    </>
  );
}

interface LoadedSessionResources {
  readonly ok: true;
  readonly sourceUri: string;
  readonly fontDataUri: string;
}

interface FailedSessionResources {
  readonly ok: false;
  readonly error: EpubRenditionError;
}

async function loadSessionResources(
  sourceUri: string,
  prepareSource: EpubReaderScreenProps['prepareSource'],
  loadReadingFont: EpubReaderScreenProps['loadReadingFont'],
): Promise<LoadedSessionResources | FailedSessionResources> {
  try {
    const [prepared, font] = await Promise.all([
      prepareSource(sourceUri),
      loadReadingFont(),
    ]);
    if (!prepared.ok) {
      return prepared;
    }
    if (!font.ok) {
      return font;
    }
    return {
      ok: true,
      sourceUri: prepared.value,
      fontDataUri: font.value,
    };
  } catch {
    return { ok: false, error: { kind: 'content-access-failure' } };
  }
}

function ReaderLoading() {
  return (
    <View accessibilityLiveRegion="polite" style={styles.overlay}>
      <ActivityIndicator color={designSystemTokens.colors.oxblood} />
      <AppText style={styles.readerMutedText}>Ouverture de l’EPUB…</AppText>
    </View>
  );
}

interface ReaderFailureProps {
  readonly onClose: () => void;
  readonly onRetry: () => void;
}

function ReaderFailure({ onClose, onRetry }: ReaderFailureProps) {
  return (
    <View accessibilityLiveRegion="assertive" style={styles.overlay}>
      <AppText style={styles.readerText} variant="quote">
        Cet EPUB ne peut pas être affiché.
      </AppText>
      <AppText style={[styles.failureCopy, styles.readerMutedText]}>
        Le fichier est peut-être endommagé ou incompatible avec le moteur de lecture.
      </AppText>
      <View style={styles.failureActions}>
        <ReaderButton label="Fermer" onPress={onClose} />
        <ReaderButton label="Réessayer" onPress={onRetry} />
      </View>
    </View>
  );
}

interface ReaderButtonProps {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly shortLabel?: string;
}

function ReaderButton({
  disabled = false,
  label,
  onPress,
  shortLabel,
}: ReaderButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={designSystemTokens.spacing[2]}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        pressed && styles.controlPressed,
        disabled && styles.controlDisabled,
      ]}>
      <AppText
        style={styles.readerText}
        variant={shortLabel === undefined ? 'button' : 'screenTitle'}>
        {shortLabel ?? label}
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
  },
  topBar: {
    minHeight: designSystemTokens.spacing[7],
    paddingHorizontal: designSystemTokens.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: designSystemTokens.spacing[3],
  },
  bookTitle: {
    flex: 1,
  },
  rendition: {
    flex: 1,
  },
  bottomBar: {
    minHeight: designSystemTokens.spacing[8],
    paddingHorizontal: designSystemTokens.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folio: {
    alignItems: 'center',
    gap: designSystemTokens.spacing[1],
  },
  control: {
    minWidth: designSystemTokens.spacing[7],
    minHeight: designSystemTokens.spacing[7],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.sm,
  },
  controlPressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
  controlDisabled: {
    opacity: designSystemTokens.interaction.disabledOpacity,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    padding: designSystemTokens.spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    gap: designSystemTokens.spacing[3],
    backgroundColor: readingThemes.paper.background,
  },
  failureCopy: {
    maxWidth: designSystemTokens.spacing[8] * 5,
    textAlign: 'center',
  },
  failureActions: {
    flexDirection: 'row',
    gap: designSystemTokens.spacing[3],
  },
  readerText: {
    color: readingThemes.paper.text,
  },
  readerMutedText: {
    color: designSystemTokens.colors.paperTextSoft,
  },
});
