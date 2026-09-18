import {
  defaultReadingDirection,
  err,
  isReadingDirection,
  ok,
  type BookId,
  type ReadingDirection,
  type Result,
} from '../../domain';

import type { RepositoryError } from '../shared/repository-error';
import type {
  ApplicationPreference,
  ApplicationPreferenceRepository,
} from './application-preference-repository';

const PREFERENCE_KEY_PREFIX = 'reader.images.reading-direction.';
const MAX_PREFERENCE_KEY_LENGTH = 128;

export interface InvalidImageReadingDirectionPreferenceError {
  readonly kind: 'invalid-image-reading-direction-preference';
  readonly reason: 'invalid-book-id' | 'invalid-value' | 'invalid-updated-at';
}

export type ImageReadingDirectionPreferenceServiceError =
  | InvalidImageReadingDirectionPreferenceError
  | RepositoryError;

export interface ImageReadingDirectionPreferenceService {
  load(
    bookId: BookId,
  ): Promise<
    Result<ReadingDirection, ImageReadingDirectionPreferenceServiceError>
  >;
  save(
    bookId: BookId,
    direction: ReadingDirection,
  ): Promise<Result<void, ImageReadingDirectionPreferenceServiceError>>;
  flush(): Promise<Result<void, ImageReadingDirectionPreferenceServiceError>>;
}

export interface ImageReadingDirectionPreferenceServiceDependencies {
  readonly repository: Pick<ApplicationPreferenceRepository, 'get' | 'save'>;
  readonly now: () => Date;
}

export function createImageReadingDirectionPreferenceService(
  dependencies: ImageReadingDirectionPreferenceServiceDependencies,
): ImageReadingDirectionPreferenceService {
  let writeTail: Promise<
    Result<void, ImageReadingDirectionPreferenceServiceError>
  > = Promise.resolve(ok(undefined));

  return {
    async load(bookId) {
      const key = preferenceKey(bookId);
      if (key === undefined) {
        return invalid('invalid-book-id');
      }
      const stored = await readPreference(dependencies.repository, key);
      if (!stored.ok) {
        return stored;
      }
      if (stored.value === null) {
        return ok(defaultReadingDirection);
      }
      return isReadingDirection(stored.value.value)
        ? ok(stored.value.value)
        : invalid('invalid-value');
    },
    save(bookId, direction) {
      const key = preferenceKey(bookId);
      if (key === undefined) {
        return Promise.resolve(invalid('invalid-book-id'));
      }
      if (!isReadingDirection(direction)) {
        return Promise.resolve(invalid('invalid-value'));
      }
      const updatedAt = dependencies.now();
      if (Number.isNaN(updatedAt.getTime())) {
        return Promise.resolve(invalid('invalid-updated-at'));
      }

      const preference: ApplicationPreference = {
        key,
        value: direction,
        updatedAt,
      };
      const write = writeTail.then(() =>
        writePreference(dependencies.repository, preference),
      );
      writeTail = write;
      return write;
    },
    flush() {
      return writeTail;
    },
  };
}

function preferenceKey(bookId: BookId): string | undefined {
  const key = `${PREFERENCE_KEY_PREFIX}${bookId}`;
  return bookId.trim().length > 0 && key.length <= MAX_PREFERENCE_KEY_LENGTH
    ? key
    : undefined;
}

async function readPreference(
  repository: Pick<ApplicationPreferenceRepository, 'get'>,
  key: string,
): Promise<
  Result<
    ApplicationPreference | null,
    ImageReadingDirectionPreferenceServiceError
  >
> {
  try {
    return await repository.get(key);
  } catch {
    return err({ kind: 'persistence-failure', operation: 'read' });
  }
}

async function writePreference(
  repository: Pick<ApplicationPreferenceRepository, 'save'>,
  preference: ApplicationPreference,
): Promise<Result<void, ImageReadingDirectionPreferenceServiceError>> {
  try {
    return await repository.save(preference);
  } catch {
    return err({ kind: 'persistence-failure', operation: 'write' });
  }
}

function invalid(
  reason: InvalidImageReadingDirectionPreferenceError['reason'],
): Result<never, InvalidImageReadingDirectionPreferenceError> {
  return err({ kind: 'invalid-image-reading-direction-preference', reason });
}
