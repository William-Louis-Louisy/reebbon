import type { SqliteConnection } from './sqlite-connection';

export interface DatabaseMigration {
  readonly version: number;
  readonly sql: string;
}

const INITIAL_SCHEMA_SQL = `
CREATE TABLE books (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  author TEXT,
  format TEXT NOT NULL CHECK (format IN ('epub', 'pdf', 'images')),
  file_uri TEXT NOT NULL CHECK (length(trim(file_uri)) > 0),
  cover_uri TEXT,
  total_pages INTEGER CHECK (total_pages IS NULL OR total_pages > 0),
  created_at TEXT NOT NULL,
  last_opened_at TEXT
);

CREATE INDEX books_created_at_idx ON books(created_at DESC);
CREATE INDEX books_last_opened_at_idx ON books(last_opened_at DESC);

CREATE TABLE reading_progress (
  book_id TEXT PRIMARY KEY NOT NULL,
  position_kind TEXT NOT NULL CHECK (position_kind IN ('epub', 'pdf', 'images')),
  position_value TEXT NOT NULL CHECK (length(position_value) > 0),
  completion_ratio REAL NOT NULL CHECK (completion_ratio >= 0 AND completion_ratio <= 1),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL,
  position_kind TEXT NOT NULL CHECK (position_kind IN ('epub', 'pdf', 'images')),
  position_value TEXT NOT NULL CHECK (length(position_value) > 0),
  label TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX bookmarks_book_id_created_at_idx ON bookmarks(book_id, created_at DESC);

CREATE TABLE application_preferences (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TRIGGER reading_progress_format_insert
BEFORE INSERT ON reading_progress
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM books WHERE id = NEW.book_id AND format = NEW.position_kind
)
BEGIN
  SELECT RAISE(ABORT, 'reading progress format mismatch');
END;

CREATE TRIGGER reading_progress_format_update
BEFORE UPDATE OF book_id, position_kind ON reading_progress
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM books WHERE id = NEW.book_id AND format = NEW.position_kind
)
BEGIN
  SELECT RAISE(ABORT, 'reading progress format mismatch');
END;

CREATE TRIGGER bookmark_format_insert
BEFORE INSERT ON bookmarks
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM books WHERE id = NEW.book_id AND format = NEW.position_kind
)
BEGIN
  SELECT RAISE(ABORT, 'bookmark format mismatch');
END;

CREATE TRIGGER bookmark_format_update
BEFORE UPDATE OF book_id, position_kind ON bookmarks
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM books WHERE id = NEW.book_id AND format = NEW.position_kind
)
BEGIN
  SELECT RAISE(ABORT, 'bookmark format mismatch');
END;

CREATE TRIGGER book_format_update
BEFORE UPDATE OF format ON books
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM reading_progress
  WHERE book_id = NEW.id AND position_kind != NEW.format
) OR EXISTS (
  SELECT 1 FROM bookmarks
  WHERE book_id = NEW.id AND position_kind != NEW.format
)
BEGIN
  SELECT RAISE(ABORT, 'book format conflicts with reading data');
END;
`;

export const databaseMigrations: readonly DatabaseMigration[] = [
  { version: 1, sql: INITIAL_SCHEMA_SQL },
];

export const latestDatabaseVersion = databaseMigrations.at(-1)?.version ?? 0;

export class UnsupportedDatabaseVersionError extends Error {
  public readonly kind = 'unsupported-database-version';

  public constructor(public readonly version: number) {
    super(`Database version ${version} is newer than supported version ${latestDatabaseVersion}.`);
  }
}

function readUserVersion(row: unknown): number {
  if (
    typeof row !== 'object' ||
    row === null ||
    !('user_version' in row) ||
    typeof row.user_version !== 'number' ||
    !Number.isInteger(row.user_version) ||
    row.user_version < 0
  ) {
    throw new Error('SQLite returned an invalid user_version.');
  }

  return row.user_version;
}

export async function migrateDatabase(connection: SqliteConnection): Promise<void> {
  await connection.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
  `);

  const currentVersion = readUserVersion(
    await connection.getFirst<unknown>('PRAGMA user_version'),
  );

  if (currentVersion > latestDatabaseVersion) {
    throw new UnsupportedDatabaseVersionError(currentVersion);
  }

  for (const migration of databaseMigrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await connection.transaction(async (transaction) => {
      await transaction.exec(migration.sql);
      await transaction.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
