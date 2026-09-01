import {
  err,
  ok,
  parseReaderPosition,
  type Book,
  type BookFormat,
  type Bookmark,
  type ReaderPosition,
  type ReadingProgress,
  type Result,
} from '../../domain';

export type PersistenceEntity = 'book' | 'reading-progress' | 'bookmark';

export interface PersistenceRecordError {
  readonly kind: 'invalid-persistence-record';
  readonly entity: PersistenceEntity;
}

export interface BookRow {
  readonly id: string;
  readonly title: string;
  readonly author: string | null;
  readonly format: BookFormat;
  readonly file_uri: string;
  readonly cover_uri: string | null;
  readonly total_pages: number | null;
  readonly created_at: string;
  readonly last_opened_at: string | null;
}

export interface ReadingProgressRow {
  readonly book_id: string;
  readonly position_kind: BookFormat;
  readonly position_value: string;
  readonly completion_ratio: number;
  readonly updated_at: string;
}

export interface BookmarkRow {
  readonly id: string;
  readonly book_id: string;
  readonly position_kind: BookFormat;
  readonly position_value: string;
  readonly label: string | null;
  readonly created_at: string;
}

function invalid(entity: PersistenceEntity): PersistenceRecordError {
  return { kind: 'invalid-persistence-record', entity };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBookFormat(value: unknown): value is BookFormat {
  return value === 'epub' || value === 'pdf' || value === 'images';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date): string | null {
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseStoredPosition(kind: unknown, value: unknown): ReaderPosition | null {
  if (!isBookFormat(kind) || typeof value !== 'string') {
    return null;
  }

  const candidate: unknown =
    kind === 'epub'
      ? { kind, cfi: value }
      : kind === 'pdf'
        ? { kind, page: Number(value) }
        : { kind, index: Number(value) };
  const parsed = parseReaderPosition(candidate);
  return parsed.ok ? parsed.value : null;
}

function serializePosition(position: ReaderPosition): string | null {
  if (!parseReaderPosition(position).ok) {
    return null;
  }

  switch (position.kind) {
    case 'epub':
      return position.cfi;
    case 'pdf':
      return String(position.page);
    case 'images':
      return String(position.index);
  }
}

export function parseBookRow(value: unknown): Result<Book, PersistenceRecordError> {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.title) ||
    !isNullableString(value.author) ||
    !isBookFormat(value.format) ||
    !isNonEmptyString(value.file_uri) ||
    !isNullableString(value.cover_uri) ||
    !(
      value.total_pages === null ||
      (typeof value.total_pages === 'number' &&
        Number.isInteger(value.total_pages) &&
        value.total_pages > 0)
    ) ||
    !isNullableString(value.last_opened_at)
  ) {
    return err(invalid('book'));
  }

  const createdAt = parseDate(value.created_at);
  const lastOpenedAt = value.last_opened_at === null ? undefined : parseDate(value.last_opened_at);

  if (createdAt === null || lastOpenedAt === null) {
    return err(invalid('book'));
  }

  return ok({
    id: value.id,
    title: value.title,
    ...(value.author === null ? {} : { author: value.author }),
    format: value.format,
    fileUri: value.file_uri,
    ...(value.cover_uri === null ? {} : { coverUri: value.cover_uri }),
    ...(value.total_pages === null ? {} : { totalPages: value.total_pages }),
    createdAt,
    ...(lastOpenedAt === undefined ? {} : { lastOpenedAt }),
  });
}

export function serializeBook(book: Book): Result<BookRow, PersistenceRecordError> {
  const createdAt = toIsoDate(book.createdAt);
  const lastOpenedAt = book.lastOpenedAt === undefined ? null : toIsoDate(book.lastOpenedAt);
  const candidate: BookRow = {
    id: book.id,
    title: book.title,
    author: book.author ?? null,
    format: book.format,
    file_uri: book.fileUri,
    cover_uri: book.coverUri ?? null,
    total_pages: book.totalPages ?? null,
    created_at: createdAt ?? '',
    last_opened_at: lastOpenedAt,
  };

  return createdAt === null || (book.lastOpenedAt !== undefined && lastOpenedAt === null)
    ? err(invalid('book'))
    : parseBookRow(candidate).ok
      ? ok(candidate)
      : err(invalid('book'));
}

export function parseReadingProgressRow(
  value: unknown,
): Result<ReadingProgress, PersistenceRecordError> {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.book_id) ||
    typeof value.completion_ratio !== 'number' ||
    !Number.isFinite(value.completion_ratio) ||
    value.completion_ratio < 0 ||
    value.completion_ratio > 1
  ) {
    return err(invalid('reading-progress'));
  }

  const position = parseStoredPosition(value.position_kind, value.position_value);
  const updatedAt = parseDate(value.updated_at);

  return position === null || updatedAt === null
    ? err(invalid('reading-progress'))
    : ok({
        bookId: value.book_id,
        position,
        completionRatio: value.completion_ratio,
        updatedAt,
      } as ReadingProgress);
}

export function serializeReadingProgress(
  progress: ReadingProgress,
): Result<ReadingProgressRow, PersistenceRecordError> {
  const positionValue = serializePosition(progress.position);
  const updatedAt = toIsoDate(progress.updatedAt);
  const candidate: ReadingProgressRow = {
    book_id: progress.bookId,
    position_kind: progress.position.kind,
    position_value: positionValue ?? '',
    completion_ratio: progress.completionRatio,
    updated_at: updatedAt ?? '',
  };

  return positionValue === null || updatedAt === null
    ? err(invalid('reading-progress'))
    : parseReadingProgressRow(candidate).ok
      ? ok(candidate)
      : err(invalid('reading-progress'));
}

export function parseBookmarkRow(value: unknown): Result<Bookmark, PersistenceRecordError> {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.book_id) ||
    !isNullableString(value.label)
  ) {
    return err(invalid('bookmark'));
  }

  const position = parseStoredPosition(value.position_kind, value.position_value);
  const createdAt = parseDate(value.created_at);

  return position === null || createdAt === null
    ? err(invalid('bookmark'))
    : ok({
        id: value.id,
        bookId: value.book_id,
        position,
        ...(value.label === null ? {} : { label: value.label }),
        createdAt,
      } as Bookmark);
}

export function serializeBookmark(
  bookmark: Bookmark,
): Result<BookmarkRow, PersistenceRecordError> {
  const positionValue = serializePosition(bookmark.position);
  const createdAt = toIsoDate(bookmark.createdAt);
  const candidate: BookmarkRow = {
    id: bookmark.id,
    book_id: bookmark.bookId,
    position_kind: bookmark.position.kind,
    position_value: positionValue ?? '',
    label: bookmark.label ?? null,
    created_at: createdAt ?? '',
  };

  return positionValue === null || createdAt === null
    ? err(invalid('bookmark'))
    : parseBookmarkRow(candidate).ok
      ? ok(candidate)
      : err(invalid('bookmark'));
}
