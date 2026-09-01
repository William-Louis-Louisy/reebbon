import {
  err,
  ok,
  type BookId,
  type Bookmark,
  type BookmarkId,
  type Result,
} from '../../../domain';
import type { BookmarkRepository, RepositoryError } from '../../../application';

import { parseBookmarkRow, serializeBookmark } from '../persistence-mappers';
import type { SqliteConnection } from '../sqlite-connection';

function failure(operation: RepositoryError['operation']): RepositoryError {
  return { kind: 'persistence-failure', operation };
}

export class SqliteBookmarkRepository implements BookmarkRepository {
  public constructor(private readonly connection: SqliteConnection) {}

  public async listByBookId(
    bookId: BookId,
  ): Promise<Result<readonly Bookmark[], RepositoryError>> {
    try {
      const rows = await this.connection.getAll<unknown>(
        `
          SELECT id, book_id, position_kind, position_value, label, created_at
          FROM bookmarks
          WHERE book_id = ?
          ORDER BY created_at DESC
        `,
        [bookId],
      );
      const bookmarks: Bookmark[] = [];

      for (const row of rows) {
        const parsed = parseBookmarkRow(row);
        if (!parsed.ok) {
          return err(failure('read'));
        }
        bookmarks.push(parsed.value);
      }

      return ok(bookmarks);
    } catch {
      return err(failure('read'));
    }
  }

  public async save(bookmark: Bookmark): Promise<Result<void, RepositoryError>> {
    const serialized = serializeBookmark(bookmark);
    if (!serialized.ok) {
      return err(failure('write'));
    }

    const row = serialized.value;
    try {
      await this.connection.run(
        `
          INSERT INTO bookmarks (
            id, book_id, position_kind, position_value, label, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            book_id = excluded.book_id,
            position_kind = excluded.position_kind,
            position_value = excluded.position_value,
            label = excluded.label
        `,
        [
          row.id,
          row.book_id,
          row.position_kind,
          row.position_value,
          row.label,
          row.created_at,
        ],
      );
      return ok(undefined);
    } catch {
      return err(failure('write'));
    }
  }

  public async delete(id: BookmarkId): Promise<Result<void, RepositoryError>> {
    try {
      await this.connection.run('DELETE FROM bookmarks WHERE id = ?', [id]);
      return ok(undefined);
    } catch {
      return err(failure('delete'));
    }
  }

  public async deleteByBookId(bookId: BookId): Promise<Result<void, RepositoryError>> {
    try {
      await this.connection.run('DELETE FROM bookmarks WHERE book_id = ?', [bookId]);
      return ok(undefined);
    } catch {
      return err(failure('delete'));
    }
  }
}
