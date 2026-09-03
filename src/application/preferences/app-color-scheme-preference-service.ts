import {
  defaultAppColorScheme,
  err,
  isAppColorScheme,
  ok,
  type AppColorScheme,
  type Result,
} from '../../domain';

import type { RepositoryError } from '../shared/repository-error';
import type {
  ApplicationPreference,
  ApplicationPreferenceRepository,
} from './application-preference-repository';

const APP_COLOR_SCHEME_PREFERENCE_KEY = 'application.color-scheme';

export interface InvalidAppColorSchemePreferenceError {
  readonly kind: 'invalid-app-color-scheme-preference';
  readonly reason: 'invalid-value' | 'invalid-updated-at';
}

export type AppColorSchemePreferenceServiceError =
  | InvalidAppColorSchemePreferenceError
  | RepositoryError;

export interface AppColorSchemePreferenceService {
  load(): Promise<
    Result<AppColorScheme, AppColorSchemePreferenceServiceError>
  >;
  save(
    colorScheme: AppColorScheme,
  ): Promise<Result<void, AppColorSchemePreferenceServiceError>>;
  flush(): Promise<Result<void, AppColorSchemePreferenceServiceError>>;
}

export interface AppColorSchemePreferenceServiceDependencies {
  readonly repository: Pick<ApplicationPreferenceRepository, 'get' | 'save'>;
  readonly now: () => Date;
}

export function createAppColorSchemePreferenceService(
  dependencies: AppColorSchemePreferenceServiceDependencies,
): AppColorSchemePreferenceService {
  let writeTail: Promise<Result<void, AppColorSchemePreferenceServiceError>> =
    Promise.resolve(ok(undefined));

  return {
    async load() {
      const stored = await readPreference(dependencies.repository);
      if (!stored.ok) {
        return stored;
      }
      if (stored.value === null) {
        return ok(defaultAppColorScheme);
      }

      return isAppColorScheme(stored.value.value)
        ? ok(stored.value.value)
        : err({
            kind: 'invalid-app-color-scheme-preference',
            reason: 'invalid-value',
          });
    },
    save(colorScheme) {
      if (!isAppColorScheme(colorScheme)) {
        return Promise.resolve(
          err({
            kind: 'invalid-app-color-scheme-preference',
            reason: 'invalid-value',
          }),
        );
      }

      const updatedAt = dependencies.now();
      if (Number.isNaN(updatedAt.getTime())) {
        return Promise.resolve(
          err({
            kind: 'invalid-app-color-scheme-preference',
            reason: 'invalid-updated-at',
          }),
        );
      }

      const preference: ApplicationPreference = {
        key: APP_COLOR_SCHEME_PREFERENCE_KEY,
        value: colorScheme,
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
  Result<ApplicationPreference | null, AppColorSchemePreferenceServiceError>
> {
  try {
    return await repository.get(APP_COLOR_SCHEME_PREFERENCE_KEY);
  } catch {
    return err({ kind: 'persistence-failure', operation: 'read' });
  }
}

async function writePreference(
  repository: Pick<ApplicationPreferenceRepository, 'save'>,
  preference: ApplicationPreference,
): Promise<Result<void, AppColorSchemePreferenceServiceError>> {
  try {
    return await repository.save(preference);
  } catch {
    return err({ kind: 'persistence-failure', operation: 'write' });
  }
}
