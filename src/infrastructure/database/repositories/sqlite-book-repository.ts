import { err, ok, type Book, type BookId, type Result } from '../../../domain';
import type { BookRepository, RepositoryError } from '../../../application';

import { parseBookRow, serializeBook } from '../persistence-mappers';
import type { SqliteConnection } from '../sqlite-connection';

const BOOK_COLUMNS = `
  id, title, author, format, file_uri, cover_uri, total_pages, created_at, last_opened_at
`;

function failure(operation: RepositoryError['operation']): RepositoryError {
  return { kind: 'persistence-failure', operation };
}

export class SqliteBookRepository implements BookRepository {
  public constructor(private readonly connection: SqliteConnection) {}

  public async getById(id: BookId): Promise<Result<Book | null, RepositoryError>> {
    try {
      const row = await this.connection.getFirst<unknown>(
        `SELECT ${BOOK_COLUMNS} FROM books WHERE id = ?`,
        [id],
      );

      if (row === null) {
        return ok(null);
      }

      const parsed = parseBookRow(row);
      return parsed.ok ? ok(parsed.value) : err(failure('read'));
    } catch {
      return err(failure('read'));
    }
  }

  public async list(): Promise<Result<readonly Book[], RepositoryError>> {
    try {
      const rows = await this.connection.getAll<unknown>(
        `SELECT ${BOOK_COLUMNS} FROM books ORDER BY created_at DESC`,
      );
      const books: Book[] = [];

      for (const row of rows) {
        const parsed = parseBookRow(row);
        if (!parsed.ok) {
          return err(failure('read'));
        }
        books.push(parsed.value);
      }

      return ok(books);
    } catch {
      return err(failure('read'));
    }
  }

  public async save(book: Book): Promise<Result<void, RepositoryError>> {
    const serialized = serializeBook(book);
    if (!serialized.ok) {
      return err(failure('write'));
    }

    const row = serialized.value;
    try {
      await this.connection.run(
        `
          INSERT INTO books (
            id, title, author, format, file_uri, cover_uri, total_pages, created_at, last_opened_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            author = excluded.author,
            format = excluded.format,
            file_uri = excluded.file_uri,
            cover_uri = excluded.cover_uri,
            total_pages = excluded.total_pages,
            last_opened_at = excluded.last_opened_at
        `,
        [
          row.id,
          row.title,
          row.author,
          row.format,
          row.file_uri,
          row.cover_uri,
          row.total_pages,
          row.created_at,
          row.last_opened_at,
        ],
      );
      return ok(undefined);
    } catch {
      return err(failure('write'));
    }
  }

  public async delete(id: BookId): Promise<Result<void, RepositoryError>> {
    try {
      await this.connection.run('DELETE FROM books WHERE id = ?', [id]);
      return ok(undefined);
    } catch {
      return err(failure('delete'));
    }
  }
}
