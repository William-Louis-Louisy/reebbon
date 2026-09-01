import { startTransition, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { createListLibraryBooks } from '@/application';
import { initializeLocalStorage } from '@/infrastructure/local-storage';
import LibraryScreen, {
  type LibraryScreenState,
} from '@/presentation/screens/library/library-screen';

const loadingState: LibraryScreenState = { status: 'loading' };
const failureState: LibraryScreenState = { status: 'failure' };

export default function LibraryRoute() {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LibraryScreenState>(loadingState);

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

  return (
    <LibraryScreen
      onImportPress={showImportUnavailable}
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
      const listLibraryBooks = createListLibraryBooks(initialized.value);
      const books = await listLibraryBooks();
      return books.ok
        ? { status: 'ready', books: books.value }
        : failureState;
    } finally {
      await initialized.value.close();
    }
  } catch {
    return failureState;
  }
}

function showImportUnavailable() {
  Alert.alert(
    'Import bientôt disponible',
    'L’import de fichiers sera bientôt disponible.',
  );
}
