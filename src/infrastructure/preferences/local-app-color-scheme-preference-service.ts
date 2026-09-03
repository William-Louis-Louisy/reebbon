import {
  createAppColorSchemePreferenceService,
  type AppColorSchemePreferenceService,
  type AppColorSchemePreferenceServiceError,
} from '../../application';
import { err, ok, type Result } from '../../domain';

import { openReebbonDatabase } from '../database/expo-sqlite-connection';
import { migrateDatabase } from '../database/migrations';
import { SqliteApplicationPreferenceRepository } from '../database/repositories/sqlite-application-preference-repository';
import type { SqliteConnection } from '../database/sqlite-connection';

export function createLocalAppColorSchemePreferenceService(): AppColorSchemePreferenceService {
  let writeTail: Promise<Result<void, AppColorSchemePreferenceServiceError>> =
    Promise.resolve(ok(undefined));

  return {
    load: () =>
      withPreferenceService('read', (service) => service.load()),
    save(colorScheme) {
      const write = writeTail.then(() =>
        withPreferenceService('write', (service) =>
          service.save(colorScheme),
        ),
      );
      writeTail = write;
      return write;
    },
    flush: () => writeTail,
  };
}

async function withPreferenceService<T>(
  operation: 'read' | 'write',
  run: (
    service: AppColorSchemePreferenceService,
  ) => Promise<Result<T, AppColorSchemePreferenceServiceError>>,
): Promise<Result<T, AppColorSchemePreferenceServiceError>> {
  let connection: SqliteConnection | undefined;
  let result: Result<T, AppColorSchemePreferenceServiceError>;

  try {
    connection = await openReebbonDatabase();
    await migrateDatabase(connection);
    result = await run(
      createAppColorSchemePreferenceService({
        repository: new SqliteApplicationPreferenceRepository(connection),
        now: () => new Date(),
      }),
    );
  } catch {
    result = persistenceFailure(operation);
  }

  if (connection !== undefined) {
    try {
      await connection.close();
    } catch {
      if (result.ok) {
        return persistenceFailure(operation);
      }
    }
  }

  return result;
}

function persistenceFailure<T>(
  operation: 'read' | 'write',
): Result<T, AppColorSchemePreferenceServiceError> {
  return err({ kind: 'persistence-failure', operation });
}
