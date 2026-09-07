import { randomUUID } from 'expo-crypto';
import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal } from 'react-native';

import {
  createEpubImporter,
  createEpubFontSizePreferenceService,
  createImportFormatDetector,
  createListLibraryBooks,
  createPdfImporter,
  createReadingProgressService,
  type ImportError,
  type EpubFontSizePreferenceService,
  type LibraryBookItem,
  type ReaderProgress,
  type ReadingProgressService,
} from '@/application';
import {
  defaultReaderFontSize,
  type Book,
  type EpubReaderPosition,
  type PdfReaderPosition,
  type ReaderFontSize,
} from '@/domain';
import {
  clearEpubRendererCache,
  EpubMetadataExtractor,
  ExpoFileImportSourcePicker,
  ExpoImportFileReader,
  ExpoPdfFirstPageRenderer,
  initializeLocalStorage,
  getExpoEpubRendererFileSystem,
  loadBundledLiterataDataUri,
  PdfMetadataExtractor,
  prepareEpubForRendering,
  type LocalStorage,
} from '@/infrastructure';
import { getImportErrorAlert } from '@/presentation/importing/import-error-alert';
import EpubReaderScreen from '@/presentation/reading/epub/epub-reader-screen';
import PdfReaderScreen from '@/presentation/reading/pdf/pdf-reader-screen';
import LibraryScreen, {
  type LibraryScreenState,
} from '@/presentation/screens/library/library-screen';
import {
  updateLibraryBookProgress,
} from '@/presentation/screens/library/library-progress';

const loadingState: LibraryScreenState = { status: 'loading' };
const failureState: LibraryScreenState = { status: 'failure' };
const importMimeTypes = ['application/epub+zip', 'application/pdf'] as const;
const importSourcePicker = new ExpoFileImportSourcePicker();
const importFileReader = new ExpoImportFileReader();
const importFormatDetector = createImportFormatDetector({ files: importFileReader });
const epubMetadataExtractor = new EpubMetadataExtractor(importFileReader);
const pdfFirstPageRenderer = new ExpoPdfFirstPageRenderer(importFileReader);
const pdfMetadataExtractor = new PdfMetadataExtractor(
  importFileReader,
  pdfFirstPageRenderer,
);

type FileImportFlowResult =
  | { readonly status: 'cancelled' }
  | { readonly status: 'success'; readonly books: readonly LibraryBookItem[] }
  | { readonly status: 'selection-failure' }
  | { readonly status: 'storage-failure' }
  | { readonly status: 'library-failure' }
  | { readonly status: 'import-failure'; readonly error: ImportError };

interface EpubReadingSession {
  readonly kind: 'epub';
  readonly book: Book<'epub'>;
  readonly fontSize: ReaderFontSize;
  readonly fontSizePreferences?: EpubFontSizePreferenceService;
  readonly initialPosition?: EpubReaderPosition;
  readonly progress?: ReadingProgressService;
  readonly storage?: LocalStorage;
}

interface PdfReadingSession {
  readonly kind: 'pdf';
  readonly book: Book<'pdf'>;
  readonly initialPosition?: PdfReaderPosition;
  readonly progress?: ReadingProgressService;
  readonly storage?: LocalStorage;
}

type ReadingSession = EpubReadingSession | PdfReadingSession;

type ReadingSessionWarning =
  | 'storage-unavailable'
  | 'progress-unavailable'
  | 'preferences-unavailable'
  | 'reading-data-unavailable';

export default function LibraryRoute() {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LibraryScreenState>(loadingState);
  const [isImporting, setIsImporting] = useState(false);
  const [readingSession, setReadingSession] =
    useState<ReadingSession | null>(null);
  const isOpeningReader = useRef(false);
  const didReportProgressFailure = useRef(false);
  const didReportFontSizeFailure = useRef(false);

  useEffect(() => {
    let active = true;

    void loadLibrary().then((nextState) => {
      if (active) {
        setState(nextState);
      }
    });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const retry = () => {
    startTransition(() => {
      setState(loadingState);
      setReloadKey((current) => current + 1);
    });
  };

  const importBook = () => {
    if (isImporting) {
      return;
    }

    setIsImporting(true);
    void runFileImport()
      .then((result) => {
        if (result.status === 'success') {
          setState({ status: 'ready', books: result.books });
          return;
        }
        showImportFailure(result);
      })
      .catch(() => {
        showImportFailure({ status: 'storage-failure' });
      })
      .finally(() => {
        setIsImporting(false);
      });
  };

  const openBook = useCallback((book: Book) => {
    if (isOpeningReader.current || readingSession !== null) {
      return;
    }
    const preparation = prepareSupportedReadingSession(book);
    if (preparation === undefined) {
      Alert.alert(
        'Lecture indisponible',
        'Le moteur de lecture de ce format n’est pas encore disponible.',
      );
      return;
    }
    isOpeningReader.current = true;
    didReportProgressFailure.current = false;
    didReportFontSizeFailure.current = false;
    void preparation
      .then(({ session, warning }) => {
        if (warning !== undefined) {
          didReportProgressFailure.current =
            warning !== 'preferences-unavailable';
          didReportFontSizeFailure.current =
            session.kind === 'epub' && warning !== 'progress-unavailable';
          showReadingSessionWarning(warning, session.kind);
        }
        setReadingSession(session);
      })
      .finally(() => {
        isOpeningReader.current = false;
      });
  }, [readingSession]);

  const publishReadingProgress = useCallback(
    (book: Book, completionRatio: number) => {
      setState((current) => {
        if (current.status !== 'ready') {
          return current;
        }
        const books = updateLibraryBookProgress(
          current.books,
          book.id,
          completionRatio,
        );
        return books === current.books ? current : { status: 'ready', books };
      });
    },
    [],
  );

  function persistReadingProgress<F extends 'epub' | 'pdf'>(
    session: {
      readonly book: Book<F>;
      readonly progress?: ReadingProgressService;
    },
    progress: ReaderProgress<F>,
  ) {
    publishReadingProgress(session.book, progress.completionRatio);
    if (session.progress === undefined) {
      return;
    }
    void session.progress.save(session.book, progress).then((saved) => {
      if (!saved.ok && !didReportProgressFailure.current) {
        didReportProgressFailure.current = true;
        showReadingSessionWarning('progress-unavailable');
      }
    });
  }

  const persistFontSize = (
    session: EpubReadingSession,
    fontSize: ReaderFontSize,
  ) => {
    if (session.fontSizePreferences === undefined) {
      return;
    }
    void session.fontSizePreferences.save(fontSize).then((saved) => {
      if (!saved.ok && !didReportFontSizeFailure.current) {
        didReportFontSizeFailure.current = true;
        showReadingSessionWarning('preferences-unavailable');
      }
    });
  };

  const closeReader = () => {
    const session = readingSession;
    setReadingSession(null);
    if (session === null) {
      return;
    }
    isOpeningReader.current = true;
    void closeReadingSession(session).finally(() => {
      isOpeningReader.current = false;
    });
  };

  return (
    <>
      <LibraryScreen
        isImporting={isImporting}
        onBookPress={openBook}
        onImportPress={importBook}
        onRetryPress={retry}
        state={state}
      />
      <Modal
        animationType="none"
        onRequestClose={closeReader}
        presentationStyle="fullScreen"
        visible={readingSession !== null}>
        {readingSession?.kind === 'epub' ? (
          <EpubReaderScreen
            book={readingSession.book}
            clearRendererCache={clearEpubRendererCache}
            fileSystem={getExpoEpubRendererFileSystem}
            initialFontSize={readingSession.fontSize}
            initialPosition={readingSession.initialPosition}
            loadReadingFont={loadBundledLiterataDataUri}
            onClose={closeReader}
            onFontSizeChange={(fontSize) =>
              persistFontSize(readingSession, fontSize)
            }
            onProgressChange={(progress) =>
              persistReadingProgress(readingSession, progress)
            }
            prepareSource={prepareEpubForRendering}
          />
        ) : readingSession?.kind === 'pdf' ? (
          <PdfReaderScreen
            book={readingSession.book}
            initialPosition={readingSession.initialPosition}
            onClose={closeReader}
            onProgressChange={(progress) =>
              persistReadingProgress(readingSession, progress)
            }
          />
        ) : null}
      </Modal>
    </>
  );
}

function prepareSupportedReadingSession(
  book: Book,
): Promise<{
  readonly session: ReadingSession;
  readonly warning?: ReadingSessionWarning;
}> | undefined {
  if (isEpubBook(book)) {
    return prepareEpubReadingSession(book);
  }
  return isPdfBook(book) ? preparePdfReadingSession(book) : undefined;
}

function isEpubBook(book: Book): book is Book<'epub'> {
  return book.format === 'epub';
}

function isPdfBook(book: Book): book is Book<'pdf'> {
  return book.format === 'pdf';
}

async function prepareEpubReadingSession(
  book: Book<'epub'>,
): Promise<{
  readonly session: EpubReadingSession;
  readonly warning?: ReadingSessionWarning;
}> {
  let storage: LocalStorage | undefined;
  try {
    const initialized = await initializeLocalStorage();
    if (!initialized.ok) {
      return {
        session: { kind: 'epub', book, fontSize: defaultReaderFontSize },
        warning: 'storage-unavailable',
      };
    }

    storage = initialized.value;
    const progress = createReadingProgressService({
      repository: storage.readingProgress,
      now: () => new Date(),
    });
    const fontSizePreferences = createEpubFontSizePreferenceService({
      repository: storage.preferences,
      now: () => new Date(),
    });
    const loaded = await progress.load(book);
    const loadedFontSize = await fontSizePreferences.load();
    const warning = getReadingSessionWarning(loaded.ok, loadedFontSize.ok);

    return {
      session: {
        kind: 'epub',
        book,
        fontSize: loadedFontSize.ok
          ? loadedFontSize.value
          : defaultReaderFontSize,
        fontSizePreferences,
        progress,
        storage,
        ...(!loaded.ok || loaded.value === null
          ? {}
          : { initialPosition: loaded.value.position }),
      },
      ...(warning === undefined ? {} : { warning }),
    };
  } catch {
    if (storage !== undefined) {
      await closeQuietly(storage);
    }
    return {
      session: { kind: 'epub', book, fontSize: defaultReaderFontSize },
      warning: 'storage-unavailable',
    };
  }
}

async function preparePdfReadingSession(
  book: Book<'pdf'>,
): Promise<{
  readonly session: PdfReadingSession;
  readonly warning?: ReadingSessionWarning;
}> {
  let storage: LocalStorage | undefined;
  try {
    const initialized = await initializeLocalStorage();
    if (!initialized.ok) {
      return {
        session: { kind: 'pdf', book },
        warning: 'storage-unavailable',
      };
    }

    storage = initialized.value;
    const progress = createReadingProgressService({
      repository: storage.readingProgress,
      now: () => new Date(),
    });
    const loaded = await progress.load(book);
    return {
      session: {
        kind: 'pdf',
        book,
        progress,
        storage,
        ...(!loaded.ok || loaded.value === null
          ? {}
          : { initialPosition: loaded.value.position }),
      },
      ...(loaded.ok ? {} : { warning: 'progress-unavailable' }),
    };
  } catch {
    if (storage !== undefined) {
      await closeQuietly(storage);
    }
    return {
      session: { kind: 'pdf', book },
      warning: 'storage-unavailable',
    };
  }
}

async function closeReadingSession(session: ReadingSession): Promise<void> {
  await Promise.all([
    session.progress?.flush(),
    session.kind === 'epub' ? session.fontSizePreferences?.flush() : undefined,
  ]);
  if (session.storage !== undefined) {
    await closeQuietly(session.storage);
  }
}

function showReadingSessionWarning(
  warning: ReadingSessionWarning,
  readerKind?: ReadingSession['kind'],
): void {
  if (warning === 'preferences-unavailable') {
    Alert.alert(
      'Préférence non enregistrée',
      'La lecture reste disponible, mais la taille de police ne peut pas être restaurée ou enregistrée pour le moment.',
    );
    return;
  }
  if (warning === 'reading-data-unavailable') {
    Alert.alert(
      'Réglages de lecture indisponibles',
      'La lecture reste disponible, mais la progression et la taille de police ne peuvent pas être restaurées ou enregistrées pour le moment.',
    );
    return;
  }
  Alert.alert(
    warning === 'storage-unavailable'
      ? 'Stockage indisponible'
      : 'Progression non enregistrée',
    warning === 'storage-unavailable'
      ? readerKind === 'epub'
        ? 'La lecture reste disponible, mais la progression et la taille de police ne peuvent pas être restaurées ou enregistrées.'
        : 'La lecture reste disponible, mais la progression ne peut pas être restaurée ou enregistrée.'
      : 'La lecture reste disponible, mais Reebbon ne peut pas restaurer ou enregistrer la position pour le moment.',
  );
}

function getReadingSessionWarning(
  progressAvailable: boolean,
  preferencesAvailable: boolean,
): ReadingSessionWarning | undefined {
  if (!progressAvailable && !preferencesAvailable) {
    return 'reading-data-unavailable';
  }
  if (!progressAvailable) {
    return 'progress-unavailable';
  }
  return preferencesAvailable ? undefined : 'preferences-unavailable';
}

async function loadLibrary(): Promise<LibraryScreenState> {
  try {
    const initialized = await initializeLocalStorage();
    if (!initialized.ok) {
      return failureState;
    }

    try {
      return await listLibrary(initialized.value);
    } finally {
      await initialized.value.close();
    }
  } catch {
    return failureState;
  }
}

async function runFileImport(): Promise<FileImportFlowResult> {
  try {
    const selected = await importSourcePicker.pickFile({ mimeTypes: importMimeTypes });
    if (!selected.ok) {
      return { status: 'selection-failure' };
    }
    if (selected.value === null) {
      return { status: 'cancelled' };
    }

    const detected = await importFormatDetector.detect(selected.value);
    if (!detected.ok) {
      return { status: 'import-failure', error: detected.error };
    }
    if (detected.value !== 'epub' && detected.value !== 'pdf') {
      return {
        status: 'import-failure',
        error: { kind: 'unsupported-format', detectedFormat: detected.value },
      };
    }

    const initialized = await initializeLocalStorage();
    if (!initialized.ok) {
      return { status: 'storage-failure' };
    }

    try {
      const sharedDependencies = {
        books: initialized.value.books,
        content: initialized.value.content,
        detector: importFormatDetector,
        createId: randomUUID,
        now: () => new Date(),
      };
      const importer =
        detected.value === 'epub'
          ? createEpubImporter({
              ...sharedDependencies,
              metadata: epubMetadataExtractor,
            })
          : createPdfImporter({
              ...sharedDependencies,
              metadata: pdfMetadataExtractor,
            });
      const imported = await importer.importBook(selected.value);
      if (!imported.ok) {
        return { status: 'import-failure', error: imported.error };
      }

      const library = await listLibrary(initialized.value);
      return library.status === 'ready'
        ? { status: 'success', books: library.books }
        : { status: 'library-failure' };
    } finally {
      await closeQuietly(initialized.value);
    }
  } catch {
    return { status: 'storage-failure' };
  }
}

async function listLibrary(storage: LocalStorage): Promise<LibraryScreenState> {
  const books = await createListLibraryBooks(storage)();
  return books.ok ? { status: 'ready', books: books.value } : failureState;
}

async function closeQuietly(storage: LocalStorage): Promise<void> {
  try {
    await storage.close();
  } catch {
    // The import result is already durable; a close failure must not report a false failure.
  }
}

function showImportFailure(result: Exclude<FileImportFlowResult, { status: 'success' }>) {
  switch (result.status) {
    case 'cancelled':
      return;
    case 'selection-failure':
      Alert.alert(
        'Sélection impossible',
        'Reebbon n’a pas pu accéder au sélecteur de fichiers.',
      );
      return;
    case 'storage-failure':
      Alert.alert(
        'Stockage indisponible',
        'Le stockage local ne peut pas être ouvert pour le moment.',
      );
      return;
    case 'library-failure':
      Alert.alert(
        'Ouvrage importé',
        'Le fichier est enregistré, mais la bibliothèque n’a pas pu être actualisée.',
      );
      return;
    case 'import-failure':
      const alert = getImportErrorAlert(result.error);
      Alert.alert(alert.title, alert.message);
  }
}
