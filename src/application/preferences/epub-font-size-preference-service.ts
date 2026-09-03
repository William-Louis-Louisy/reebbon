import {
  defaultReaderFontSize,
  err,
  ok,
  parseReaderFontSize,
  type ReaderFontSize,
  type Result,
} from '../../domain';

import type { RepositoryError } from '../shared/repository-error';
import type {
  ApplicationPreference,
  ApplicationPreferenceRepository,
} from './application-preference-repository';

const EPUB_FONT_SIZE_PREFERENCE_KEY = 'reader.epub.font-size';

export interface InvalidEpubFontSizePreferenceError {
  readonly kind: 'invalid-epub-font-size-preference';
  readonly reason: 'invalid-value' | 'invalid-updated-at';
}

export type EpubFontSizePreferenceServiceError =
  | InvalidEpubFontSizePreferenceError
  | RepositoryError;

export interface EpubFontSizePreferenceService {
  load(): Promise<
    Result<ReaderFontSize, EpubFontSizePreferenceServiceError>
  >;
  save(
    fontSize: ReaderFontSize,
  ): Promise<Result<void, EpubFontSizePreferenceServiceError>>;
  flush(): Promise<Result<void, EpubFontSizePreferenceServiceError>>;
}

export interface EpubFontSizePreferenceServiceDependencies {
  readonly repository: Pick<ApplicationPreferenceRepository, 'get' | 'save'>;
  readonly now: () => Date;
}

export function createEpubFontSizePreferenceService(
  dependencies: EpubFontSizePreferenceServiceDependencies,
): EpubFontSizePreferenceService {
  let writeTail: Promise<Result<void, EpubFontSizePreferenceServiceError>> =
    Promise.resolve(ok(undefined));

  return {
    async load() {
      const stored = await readPreference(dependencies.repository);
      if (!stored.ok) {
        return stored;
      }
      if (stored.value === null) {
        return ok(defaultReaderFontSize);
      }

      const parsed = parseReaderFontSize(Number(stored.value.value));
      return parsed.ok
        ? parsed
        : err({
            kind: 'invalid-epub-font-size-preference',
            reason: 'invalid-value',
          });
    },
    save(fontSize) {
      if (!parseReaderFontSize(fontSize).ok) {
        return Promise.resolve(
          err({
            kind: 'invalid-epub-font-size-preference',
            reason: 'invalid-value',
          }),
        );
      }

      const updatedAt = dependencies.now();
      if (Number.isNaN(updatedAt.getTime())) {
        return Promise.resolve(
          err({
            kind: 'invalid-epub-font-size-preference',
            reason: 'invalid-updated-at',
          }),
        );
      }

      const preference: ApplicationPreference = {
        key: EPUB_FONT_SIZE_PREFERENCE_KEY,
        value: String(fontSize),
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

async function readPreference(
  repository: Pick<ApplicationPreferenceRepository, 'get'>,
): Promise<
  Result<ApplicationPreference | null, EpubFontSizePreferenceServiceError>
> {
  try {
    return await repository.get(EPUB_FONT_SIZE_PREFERENCE_KEY);
  } catch {
    return err({ kind: 'persistence-failure', operation: 'read' });
  }
}

async function writePreference(
  repository: Pick<ApplicationPreferenceRepository, 'save'>,
  preference: ApplicationPreference,
): Promise<Result<void, EpubFontSizePreferenceServiceError>> {
  try {
    return await repository.save(preference);
  } catch {
    return err({ kind: 'persistence-failure', operation: 'write' });
  }
}
