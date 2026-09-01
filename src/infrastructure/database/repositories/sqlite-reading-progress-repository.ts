import { err, ok, type BookId, type ReadingProgress, type Result } from '../../../domain';
import type { ReadingProgressRepository, RepositoryError } from '../../../application';

import {
  parseReadingProgressRow,
  serializeReadingProgress,
} from '../persistence-mappers';
import type { SqliteConnection } from '../sqlite-connection';

function failure(operation: RepositoryError['operation']): RepositoryError {
  return { kind: 'persistence-failure', operation };
}

export class SqliteReadingProgressRepository implements ReadingProgressRepository {
  public constructor(private readonly connection: SqliteConnection) {}

  public async getByBookId(
    bookId: BookId,
  ): Promise<Result<ReadingProgress | null, RepositoryError>> {
    try {
      const row = await this.connection.getFirst<unknown>(
        `
          SELECT book_id, position_kind, position_value, completion_ratio, updated_at
          FROM reading_progress
          WHERE book_id = ?
        `,
        [bookId],
      );

      if (row === null) {
        return ok(null);
      }

      const parsed = parseReadingProgressRow(row);
      return parsed.ok ? ok(parsed.value) : err(failure('read'));
    } catch {
      return err(failure('read'));
    }
  }

  public async save(progress: ReadingProgress): Promise<Result<void, RepositoryError>> {
    const serialized = serializeReadingProgress(progress);
    if (!serialized.ok) {
      return err(failure('write'));
    }

    const row = serialized.value;
    try {
      await this.connection.run(
        `
          INSERT INTO reading_progress (
            book_id, position_kind, position_value, completion_ratio, updated_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(book_id) DO UPDATE SET
            position_kind = excluded.position_kind,
            position_value = excluded.position_value,
            completion_ratio = excluded.completion_ratio,
            updated_at = excluded.updated_at
        `,
        [
          row.book_id,
          row.position_kind,
          row.position_value,
          row.completion_ratio,
          row.updated_at,
        ],
      );
      return ok(undefined);
    } catch {
      return err(failure('write'));
    }
  }

  public async deleteByBookId(bookId: BookId): Promise<Result<void, RepositoryError>> {
    try {
      await this.connection.run('DELETE FROM reading_progress WHERE book_id = ?', [bookId]);
      return ok(undefined);
    } catch {
      return err(failure('delete'));
    }
  }
}
