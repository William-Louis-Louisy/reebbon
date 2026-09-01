import { randomUUID } from 'expo-crypto';
import { startTransition, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  createEpubImporter,
  createListLibraryBooks,
  type ImportError,
  type LibraryBookItem,
} from '@/application';
import {
  ExpoFileImportSourcePicker,
  initializeLocalStorage,
  type LocalStorage,
} from '@/infrastructure';
import LibraryScreen, {
  type LibraryScreenState,
} from '@/presentation/screens/library/library-screen';

const loadingState: LibraryScreenState = { status: 'loading' };
const failureState: LibraryScreenState = { status: 'failure' };
const epubMimeTypes = ['application/epub+zip'] as const;
const importSourcePicker = new ExpoFileImportSourcePicker();

type EpubImportFlowResult =
  | { readonly status: 'cancelled' }
  | { readonly status: 'success'; readonly books: readonly LibraryBookItem[] }
  | { readonly status: 'selection-failure' }
  | { readonly status: 'storage-failure' }
  | { readonly status: 'library-failure' }
  | { readonly status: 'import-failure'; readonly error: ImportError };

export default function LibraryRoute() {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LibraryScreenState>(loadingState);
  const [isImporting, setIsImporting] = useState(false);

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

  const importEpub = () => {
    if (isImporting) {
      return;
    }

    setIsImporting(true);
    void runEpubImport()
      .then((result) => {
        if (result.status === 'success') {
          setState({ status: 'ready', books: result.books });
          return;
        }
        showImportFailure(result);
      })
      .finally(() => {
        setIsImporting(false);
      });
  };

  return (
    <LibraryScreen
      isImporting={isImporting}
      onImportPress={importEpub}
      onRetryPress={retry}
      state={state}
    />
  );
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

async function runEpubImport(): Promise<EpubImportFlowResult> {
  try {
    const selected = await importSourcePicker.pickFile({ mimeTypes: epubMimeTypes });
    if (!selected.ok) {
      return { status: 'selection-failure' };
    }
    if (selected.value === null) {
      return { status: 'cancelled' };
    }

    const initialized = await initializeLocalStorage();
    if (!initialized.ok) {
      return { status: 'storage-failure' };
    }

    try {
      const importer = createEpubImporter({
        books: initialized.value.books,
        content: initialized.value.content,
        createId: randomUUID,
        now: () => new Date(),
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

function showImportFailure(result: Exclude<EpubImportFlowResult, { status: 'success' }>) {
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
      Alert.alert('Import impossible', importErrorMessage(result.error));
  }
}

function importErrorMessage(error: ImportError): string {
  switch (error.kind) {
    case 'unsupported-format':
      return 'Sélectionnez un fichier portant l’extension EPUB.';
    case 'corrupted-source':
      return 'Ce fichier EPUB semble endommagé.';
    case 'permission-or-access-failure':
      return 'Reebbon n’a pas pu lire le fichier sélectionné.';
    case 'filesystem-failure':
      return 'Le fichier n’a pas pu être copié dans le stockage local.';
    case 'metadata-extraction-failure':
      return 'Les informations de cet EPUB n’ont pas pu être lues.';
    case 'persistence-failure':
      return 'L’ouvrage n’a pas pu être ajouté à la bibliothèque.';
  }
}
