import type {
  ApplicationPreferenceRepository,
  BookContentStore,
  BookRepository,
  BookmarkRepository,
  FileStorageError,
  ReadingProgressRepository,
} from '../application';
import { err, ok, type Result } from '../domain';

import { migrateDatabase } from './database/migrations';
import { SqliteApplicationPreferenceRepository } from './database/repositories/sqlite-application-preference-repository';
import { SqliteBookmarkRepository } from './database/repositories/sqlite-bookmark-repository';
import { SqliteBookRepository } from './database/repositories/sqlite-book-repository';
import { SqliteReadingProgressRepository } from './database/repositories/sqlite-reading-progress-repository';
import type { SqliteConnection } from './database/sqlite-connection';

export type LocalStorageInitializationError =
  | { readonly kind: 'database-initialization-failure' }
  | FileStorageError;

export interface LocalStorage {
  readonly books: BookRepository;
  readonly readingProgress: ReadingProgressRepository;
  readonly bookmarks: BookmarkRepository;
  readonly preferences: ApplicationPreferenceRepository;
  readonly content: BookContentStore;
  close(): Promise<void>;
}

export interface LocalStorageDependencies {
  readonly openDatabase: () => Promise<SqliteConnection>;
  readonly contentStore: BookContentStore;
}

async function closeQuietly(connection: SqliteConnection | undefined): Promise<void> {
  if (connection === undefined) {
    return;
  }

  try {
    await connection.close();
  } catch {
    // Initialization already failed; cleanup must not replace the typed root error.
  }
}

export async function initializeLocalStorageWithDependencies(
  dependencies: LocalStorageDependencies,
): Promise<Result<LocalStorage, LocalStorageInitializationError>> {
  let connection: SqliteConnection | undefined;

  try {
    connection = await dependencies.openDatabase();
    await migrateDatabase(connection);
  } catch {
    await closeQuietly(connection);
    return err({ kind: 'database-initialization-failure' });
  }

  const content = dependencies.contentStore;
  let contentInitialization: Result<void, FileStorageError>;

  try {
    contentInitialization = await content.initialize();
  } catch {
    await closeQuietly(connection);
    return err({ kind: 'filesystem-failure', operation: 'initialize' });
  }

  if (!contentInitialization.ok) {
    await closeQuietly(connection);
    return err(contentInitialization.error);
  }

  return ok({
    books: new SqliteBookRepository(connection),
    readingProgress: new SqliteReadingProgressRepository(connection),
    bookmarks: new SqliteBookmarkRepository(connection),
    preferences: new SqliteApplicationPreferenceRepository(connection),
    content,
    close: () => connection.close(),
  });
}
