/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createReadingProgressService } from '../../src/application';
import { ok, type Book } from '../../src/domain';
import { migrateDatabase } from '../../src/infrastructure/database/migrations';
import { SqliteBookRepository } from '../../src/infrastructure/database/repositories/sqlite-book-repository';
import { SqliteReadingProgressRepository } from '../../src/infrastructure/database/repositories/sqlite-reading-progress-repository';
import { NodeSqliteConnection } from '../infrastructure/database/node-sqlite-connection';

test('a new PDF reading session restores the latest one-based page', async () => {
  const connection = new NodeSqliteConnection();
  const book: Book<'pdf'> = {
    id: 'pdf-progress-book',
    title: 'Persistent PDF',
    format: 'pdf',
    fileUri: 'file:///documents/reebbon/books/pdf-progress-book/book.pdf',
    totalPages: 12,
    createdAt: new Date('2026-09-07T08:00:00.000Z'),
  };

  try {
    await migrateDatabase(connection);
    const books = new SqliteBookRepository(connection);
    const repository = new SqliteReadingProgressRepository(connection);
    assert.deepEqual(await books.save(book), ok(undefined));

    const writingSession = createReadingProgressService({
      repository,
      now: () => new Date('2026-09-07T10:00:00.000Z'),
    });
    void writingSession.save(book, {
      position: { kind: 'pdf', page: 3 },
      completionRatio: 2 / 11,
    });
    void writingSession.save(book, {
      position: { kind: 'pdf', page: 8 },
      completionRatio: 7 / 11,
    });
    assert.deepEqual(await writingSession.flush(), ok(undefined));

    const reopenedSession = createReadingProgressService({
      repository,
      now: () => new Date('2026-09-07T11:00:00.000Z'),
    });
    assert.deepEqual(
      await reopenedSession.load(book),
      ok({
        position: { kind: 'pdf', page: 8 },
        completionRatio: 7 / 11,
      }),
    );
  } finally {
    await connection.close();
  }
});
