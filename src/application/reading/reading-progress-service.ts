import {
  err,
  ok,
  type Book,
  type BookFormat,
  type ReaderPositionFor,
  type ReadingProgress,
  type Result,
} from '../../domain';

import type { ReaderProgress } from '../reader/reader';
import type { RepositoryError } from '../shared/repository-error';
import type { ReadingProgressRepository } from './reading-progress-repository';

export type InvalidReadingProgressReason =
  | 'book-mismatch'
  | 'format-mismatch'
  | 'invalid-completion-ratio'
  | 'invalid-updated-at';

export interface InvalidReadingProgressError {
  readonly kind: 'invalid-reading-progress';
  readonly reason: InvalidReadingProgressReason;
}

export type ReadingProgressServiceError =
  | InvalidReadingProgressError
  | RepositoryError;

export interface ReadingProgressService {
  load<F extends BookFormat>(
    book: Book<F>,
  ): Promise<Result<ReaderProgress<F> | null, ReadingProgressServiceError>>;
  save<F extends BookFormat>(
    book: Book<F>,
    progress: ReaderProgress<F>,
  ): Promise<Result<void, ReadingProgressServiceError>>;
  flush(): Promise<Result<void, ReadingProgressServiceError>>;
}

export interface ReadingProgressServiceDependencies {
  readonly repository: Pick<ReadingProgressRepository, 'getByBookId' | 'save'>;
  readonly now: () => Date;
}

export function createReadingProgressService(
  dependencies: ReadingProgressServiceDependencies,
): ReadingProgressService {
  let writeTail: Promise<Result<void, ReadingProgressServiceError>> =
    Promise.resolve(ok(undefined));

  return {
    async load(book) {
      const stored = await readProgress(dependencies.repository, book.id);
      if (!stored.ok) {
        return err(stored.error);
      }
      if (stored.value === null) {
        return ok(null);
      }
      return toReaderProgress(book, stored.value);
    },
    save(book, progress) {
      const record = toReadingProgress(book, progress, dependencies.now());
      if (!record.ok) {
        return Promise.resolve(record);
      }

      const write = writeTail.then(() =>
        writeProgress(dependencies.repository, record.value),
      );
      writeTail = write;
      return write;
    },
    flush() {
      return writeTail;
    },
  };
}

async function readProgress(
  repository: Pick<ReadingProgressRepository, 'getByBookId'>,
  bookId: string,
): Promise<Result<ReadingProgress | null, ReadingProgressServiceError>> {
  try {
    return await repository.getByBookId(bookId);
  } catch {
    return err({ kind: 'persistence-failure', operation: 'read' });
  }
}

async function writeProgress(
  repository: Pick<ReadingProgressRepository, 'save'>,
  progress: ReadingProgress,
): Promise<Result<void, ReadingProgressServiceError>> {
  try {
    return await repository.save(progress);
  } catch {
    return err({ kind: 'persistence-failure', operation: 'write' });
  }
}

function toReaderProgress<F extends BookFormat>(
  book: Book<F>,
  stored: ReadingProgress,
): Result<ReaderProgress<F>, InvalidReadingProgressError> {
  if (stored.bookId !== book.id) {
    return invalid('book-mismatch');
  }
  if (stored.position.kind !== book.format) {
    return invalid('format-mismatch');
  }
  if (!isCompletionRatio(stored.completionRatio)) {
    return invalid('invalid-completion-ratio');
  }

  return ok({
    position: stored.position as ReaderPositionFor<F>,
    completionRatio: stored.completionRatio,
  });
}

function toReadingProgress<F extends BookFormat>(
  book: Book<F>,
  progress: ReaderProgress<F>,
  updatedAt: Date,
): Result<ReadingProgress, InvalidReadingProgressError> {
  if (progress.position.kind !== book.format) {
    return invalid('format-mismatch');
  }
  if (!isCompletionRatio(progress.completionRatio)) {
    return invalid('invalid-completion-ratio');
  }
  if (Number.isNaN(updatedAt.getTime())) {
    return invalid('invalid-updated-at');
  }

  return ok({
    bookId: book.id,
    position: progress.position,
    completionRatio: progress.completionRatio,
    updatedAt,
  } as ReadingProgress);
}

function invalid(
  reason: InvalidReadingProgressReason,
): Result<never, InvalidReadingProgressError> {
  return err({ kind: 'invalid-reading-progress', reason });
}

function isCompletionRatio(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
