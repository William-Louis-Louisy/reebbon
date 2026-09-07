import {
  Reader as CoreReader,
  ReaderProvider,
  useReader as useCoreReader,
  type Location as CoreLocation,
} from '@epubjs-react-native/core';
import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  createEpubReader,
  type EpubRenditionError,
  type Reader,
  type ReaderTableOfContentsEntry,
} from '@/application';
import {
  defaultReaderHorizontalMargin,
  defaultReaderLineSpacing,
  stepReaderFontSize,
  type ReaderFontSize,
  type ReaderHorizontalMargin,
  type ReaderLineSpacing,
} from '@/domain';
import { readingThemes, type ReadingThemeName } from '@/shared/theme';

import {
  ReaderChromeButton,
  ReaderFailure,
  ReaderLoading,
  ReaderScreenChrome,
} from '../reader-screen-chrome';
import { ReaderSettingsSheet } from '../reader-settings-sheet';
import { EpubFontSizeControl } from './epub-font-size-control';
import { EpubLayoutControl } from './epub-layout-control';
import { EpubRenditionBridge } from './epub-rendition-bridge';
import { EpubReadingThemeSelector } from './epub-reading-theme-selector';
import { EpubTableOfContentsSheet } from './epub-table-of-contents-sheet';
import {
  createEpubHorizontalMarginInjection,
  createEpubLineSpacingInjection,
  createLiterataInjection,
  epubCoreThemes,
  formatEpubFontSize,
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
  initialFontSize,
  initialPosition,
  loadReadingFont,
  onClose,
  onFontSizeChange,
  onProgressChange,
  prepareSource,
  reader,
}: EpubReaderSessionProps) {
  const coreReader = useCoreReader();
  const {
    changeFontSize,
    changeTheme,
    goNext,
    goPrevious,
    goToLocation,
    injectJavascript,
  } = coreReader;
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
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [readingThemeName, setReadingThemeName] =
    useState<ReadingThemeName>('paper');
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [horizontalMargin, setHorizontalMargin] =
    useState<ReaderHorizontalMargin>(defaultReaderHorizontalMargin);
  const [lineSpacing, setLineSpacing] =
    useState<ReaderLineSpacing>(defaultReaderLineSpacing);
  const folio = getEpubFolio(snapshot.location);

  useEffect(() =>
    bridge.attachControls({
      goToLocation,
      goPrevious,
      goNext,
      changeTheme: (theme) => changeTheme(epubCoreThemes[theme]),
      changeFontSize: (size) => changeFontSize(formatEpubFontSize(size)),
      changeHorizontalMargin: (margin) =>
        injectJavascript(createEpubHorizontalMarginInjection(margin)),
      changeLineSpacing: (spacing) =>
        injectJavascript(createEpubLineSpacingInjection(spacing)),
    }), [
    bridge,
    changeFontSize,
    changeTheme,
    goNext,
    goPrevious,
    goToLocation,
    injectJavascript,
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
    } else {
      bridge.reportLocation(parsed.value);
    }
    void Promise.resolve().then(() => {
      if (ready) {
        void reader.setTheme(readingThemeName).then((result) => {
          if (!result.ok) {
            return;
          }
          void Promise.all([
            reader.fontCustomization?.setFontSize(fontSize),
            reader.layoutCustomization?.setHorizontalMargin(horizontalMargin),
            reader.layoutCustomization?.setLineSpacing(lineSpacing),
          ]);
        });
      }
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

  const selectReadingTheme = (theme: ReadingThemeName) => {
    if (theme === readingThemeName || snapshot.status !== 'ready') {
      return;
    }
    void reader.setTheme(theme).then((result) => {
      if (result.ok) {
        setReadingThemeName(theme);
      }
    });
  };

  const selectFontSize = (nextFontSize: ReaderFontSize) => {
    const customization = reader.fontCustomization;
    if (
      customization === undefined ||
      nextFontSize === fontSize ||
      snapshot.status !== 'ready'
    ) {
      return;
    }
    void customization.setFontSize(nextFontSize).then((result) => {
      if (result.ok) {
        setFontSize(nextFontSize);
        onFontSizeChange(nextFontSize);
      }
    });
  };

  const selectHorizontalMargin = (nextMargin: ReaderHorizontalMargin) => {
    const customization = reader.layoutCustomization;
    if (
      customization === undefined ||
      nextMargin === horizontalMargin ||
      snapshot.status !== 'ready'
    ) {
      return;
    }
    void customization.setHorizontalMargin(nextMargin).then((result) => {
      if (result.ok) {
        setHorizontalMargin(nextMargin);
      }
    });
  };

  const selectLineSpacing = (nextLineSpacing: ReaderLineSpacing) => {
    const customization = reader.layoutCustomization;
    if (
      customization === undefined ||
      nextLineSpacing === lineSpacing ||
      snapshot.status !== 'ready'
    ) {
      return;
    }
    void customization.setLineSpacing(nextLineSpacing).then((result) => {
      if (result.ok) {
        setLineSpacing(nextLineSpacing);
      }
    });
  };

  const close = () => {
    setIsTableOfContentsVisible(false);
    setIsSettingsVisible(false);
    void reader.close().finally(onClose);
  };

  const retry = () => {
    setCompletionRatio(0);
    setTableOfContentsEntries([]);
    setIsTableOfContentsVisible(false);
    setIsSettingsVisible(false);
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
      <ReaderScreenChrome
        bookTitle={book.title}
        completionRatio={completionRatio}
        folio={folio}
        headerActions={
          <>
            <ReaderChromeButton
              color={readingThemes[readingThemeName].text}
              label="Réglages"
              onPress={() => setIsSettingsVisible(true)}
              shortLabel="Aa"
            />
            {tableOfContentsEntries.length > 0 ? (
              <ReaderChromeButton
                color={readingThemes[readingThemeName].text}
                label="Sommaire"
                onPress={() => setIsTableOfContentsVisible(true)}
              />
            ) : null}
          </>
        }
        isNextDisabled={snapshot.status !== 'ready'}
        isPreviousDisabled={snapshot.status !== 'ready'}
        onClose={close}
        onNext={() => bridge.nextPage()}
        onPrevious={() => bridge.previousPage()}
        themeName={readingThemeName}>
        {snapshot.status === 'failure' || preparationError !== undefined ? (
          <ReaderFailure
            message="Le fichier est peut-être endommagé ou incompatible avec le moteur de lecture."
            onClose={close}
            onRetry={retry}
            themeName={readingThemeName}
            title="Cet EPUB ne peut pas être affiché."
          />
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
          <ReaderLoading label="Ouverture de l’EPUB…" themeName={readingThemeName} />
        ) : null}
      </ReaderScreenChrome>
      <EpubTableOfContentsSheet
        entries={tableOfContentsEntries}
        onClose={() => setIsTableOfContentsVisible(false)}
        onSelect={selectTableOfContentsEntry}
        themeName={readingThemeName}
        visible={isTableOfContentsVisible}
      />
      <ReaderSettingsSheet
        capabilities={reader.capabilities}
        fontCustomizationControl={
          reader.fontCustomization === undefined ? undefined : (
            <EpubFontSizeControl
              disabled={snapshot.status !== 'ready'}
              fontSize={fontSize}
              onDecrease={() =>
                selectFontSize(stepReaderFontSize(fontSize, 'decrease'))
              }
              onIncrease={() =>
                selectFontSize(stepReaderFontSize(fontSize, 'increase'))
              }
              themeName={readingThemeName}
            />
          )
        }
        layoutCustomizationControl={
          reader.layoutCustomization === undefined ? undefined : (
            <EpubLayoutControl
              disabled={snapshot.status !== 'ready'}
              horizontalMargin={horizontalMargin}
              lineSpacing={lineSpacing}
              onHorizontalMarginChange={selectHorizontalMargin}
              onLineSpacingChange={selectLineSpacing}
              themeName={readingThemeName}
            />
          )
        }
        onClose={() => setIsSettingsVisible(false)}
        readingThemeControl={
          <EpubReadingThemeSelector
            disabled={snapshot.status !== 'ready'}
            onSelect={selectReadingTheme}
            selectedTheme={readingThemeName}
          />
        }
        themeName={readingThemeName}
        visible={isSettingsVisible}
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
