import type {
  ApplicationPreference,
  ApplicationPreferenceRepository,
  RepositoryError,
} from '../../../application';
import { err, ok, type Result } from '../../../domain';

import type { SqliteConnection } from '../sqlite-connection';

function failure(operation: RepositoryError['operation']): RepositoryError {
  return { kind: 'persistence-failure', operation };
}

export class SqliteApplicationPreferenceRepository
  implements ApplicationPreferenceRepository
{
  public constructor(private readonly connection: SqliteConnection) {}

  public async get(
    key: string,
  ): Promise<Result<ApplicationPreference | null, RepositoryError>> {
    if (!isValidKey(key)) {
      return err(failure('read'));
    }

    try {
      const row = await this.connection.getFirst<unknown>(
        `
          SELECT key, value, updated_at
          FROM application_preferences
          WHERE key = ?
        `,
        [key],
      );
      if (row === null) {
        return ok(null);
      }

      const parsed = parseRow(row);
      return parsed === null ? err(failure('read')) : ok(parsed);
    } catch {
      return err(failure('read'));
    }
  }

  public async save(
    preference: ApplicationPreference,
  ): Promise<Result<void, RepositoryError>> {
    if (!isValidPreference(preference)) {
      return err(failure('write'));
    }

    try {
      await this.connection.run(
        `
          INSERT INTO application_preferences (key, value, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        `,
        [
          preference.key,
          preference.value,
          preference.updatedAt.toISOString(),
        ],
      );
      return ok(undefined);
    } catch {
      return err(failure('write'));
    }
  }
}

function parseRow(value: unknown): ApplicationPreference | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('key' in value) ||
    !('value' in value) ||
    !('updated_at' in value) ||
    !isValidKey(value.key) ||
    typeof value.value !== 'string' ||
    typeof value.updated_at !== 'string'
  ) {
    return null;
  }

  const updatedAt = new Date(value.updated_at);
  return Number.isNaN(updatedAt.getTime())
    ? null
    : { key: value.key, value: value.value, updatedAt };
}

function isValidPreference(
  preference: ApplicationPreference,
): boolean {
  return (
    isValidKey(preference.key) &&
    typeof preference.value === 'string' &&
    !Number.isNaN(preference.updatedAt.getTime())
  );
}

function isValidKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 128
  );
}
