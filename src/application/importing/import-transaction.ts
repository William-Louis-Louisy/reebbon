import { err, ok, type Book, type Result } from '../../domain';

import type { BookRepository } from '../library/book-repository';
import type { RepositoryError } from '../shared/repository-error';
import type {
  BookContentStore,
  FileStorageError,
  FileStorageOperation,
} from '../storage/book-content-store';
import type {
  ImportError,
  ImportFormat,
  ImportResult,
  ImportSource,
  ReaderFormatForImport,
} from './importer';

export interface ImportTransactionDependencies {
  readonly books: Pick<BookRepository, 'save' | 'delete'>;
  readonly content: BookContentStore;
  readonly createId: () => string;
  readonly now: () => Date;
}

export interface PreparedStagedBook<F extends ImportFormat> {
  createBook(
    bookId: string,
    contentUri: string,
    createdAt: Date,
  ): Book<ReaderFormatForImport<F>>;
}

interface ImportProgress {
  stagingAttempted: boolean;
  commitAttempted: boolean;
  saveAttempted: boolean;
}

export async function executeImportTransaction<F extends ImportFormat>(
  source: ImportSource,
  dependencies: ImportTransactionDependencies,
  stage: (
    importId: string,
  ) => Promise<Result<PreparedStagedBook<F>, ImportError>>,
): Promise<Result<ImportResult<F>, ImportError>> {
  const identifiers = createIdentifiers(dependencies.createId);
  if (identifiers === null) {
    return err({ kind: 'persistence-failure', operation: 'save' });
  }

  const { bookId, importId } = identifiers;
  const progress: ImportProgress = {
    stagingAttempted: false,
    commitAttempted: false,
    saveAttempted: false,
  };
  const fail = async (error: ImportError) => {
    const cleanupError = await rollbackImport(
      dependencies,
      importId,
      bookId,
      progress,
    );
    return err(cleanupError ?? error);
  };

  progress.stagingAttempted = true;
  const staging = await callImportStorage(
    () => dependencies.content.createStagingArea(importId),
    'create-staging-area',
  );
  if (!staging.ok) {
    return fail(storageErrorForImport(source, staging.error, 'stage'));
  }

  let staged: Result<PreparedStagedBook<F>, ImportError>;
  try {
    staged = await stage(importId);
  } catch {
    staged = err({ kind: 'filesystem-failure', operation: 'stage' });
  }
  if (!staged.ok) {
    return fail(staged.error);
  }

  progress.commitAttempted = true;
  const committed = await callImportStorage(
    () => dependencies.content.commitStagingArea(importId, bookId),
    'commit-staging-area',
  );
  if (!committed.ok) {
    return fail(storageErrorForImport(source, committed.error, 'copy'));
  }

  let book: Book<ReaderFormatForImport<F>>;
  try {
    book = staged.value.createBook(
      bookId,
      committed.value.uri,
      safelyCreateDate(dependencies.now),
    );
  } catch {
    return fail({ kind: 'persistence-failure', operation: 'save' });
  }

  progress.saveAttempted = true;
  const saved = await callRepository(() => dependencies.books.save(book), 'write');
  if (!saved.ok) {
    return fail({ kind: 'persistence-failure', operation: 'save' });
  }

  return ok({ book } satisfies ImportResult<F>);
}

export async function callImportStorage<T>(
  operation: () => Promise<Result<T, FileStorageError>>,
  fallbackOperation: FileStorageOperation,
): Promise<Result<T, FileStorageError>> {
  try {
    return await operation();
  } catch {
    return err({ kind: 'filesystem-failure', operation: fallbackOperation });
  }
}

export function storageErrorForImport(
  source: ImportSource,
  error: FileStorageError,
  operation: 'stage' | 'copy',
): ImportError {
  return error.kind === 'permission-or-access-failure'
    ? { kind: 'permission-or-access-failure', source }
    : { kind: 'filesystem-failure', operation };
}

function createIdentifiers(
  createId: () => string,
): { readonly bookId: string; readonly importId: string } | null {
  try {
    const bookId = createId();
    const importId = `import-${createId()}`;
    return isSafeIdentifier(bookId) && isSafeIdentifier(importId)
      ? { bookId, importId }
      : null;
  } catch {
    return null;
  }
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

function safelyCreateDate(now: () => Date): Date {
  try {
    return now();
  } catch {
    return new Date(Number.NaN);
  }
}

async function callRepository(
  operation: () => Promise<Result<void, RepositoryError>>,
  fallbackOperation: RepositoryError['operation'],
): Promise<Result<void, RepositoryError>> {
  try {
    return await operation();
  } catch {
    return err({ kind: 'persistence-failure', operation: fallbackOperation });
  }
}

async function rollbackImport(
  dependencies: ImportTransactionDependencies,
  importId: string,
  bookId: string,
  progress: ImportProgress,
): Promise<ImportError | undefined> {
  let rollbackError: ImportError | undefined;

  if (progress.saveAttempted) {
    const deleted = await callRepository(() => dependencies.books.delete(bookId), 'delete');
    if (!deleted.ok) {
      rollbackError = { kind: 'persistence-failure', operation: 'rollback' };
    }
  }

  if (progress.commitAttempted) {
    const removedBookFiles = await callImportStorage(
      () => dependencies.content.removeBookFiles(bookId),
      'remove-book-files',
    );
    if (!removedBookFiles.ok && rollbackError === undefined) {
      rollbackError = { kind: 'filesystem-failure', operation: 'cleanup' };
    }
  }

  if (progress.stagingAttempted) {
    const removedStaging = await callImportStorage(
      () => dependencies.content.removeStagingArea(importId),
      'remove-staging-area',
    );
    if (!removedStaging.ok && rollbackError === undefined) {
      rollbackError = { kind: 'filesystem-failure', operation: 'cleanup' };
    }
  }

  return rollbackError;
}
