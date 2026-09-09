/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createReadingProgressService } from '../../src/application';
import { ok, type Book } from '../../src/domain';
import { migrateDatabase } from '../../src/infrastructure/database/migrations';
import { SqliteBookRepository } from '../../src/infrastructure/database/repositories/sqlite-book-repository';
import { SqliteReadingProgressRepository } from '../../src/infrastructure/database/repositories/sqlite-reading-progress-repository';
import { NodeSqliteConnection } from '../infrastructure/database/node-sqlite-connection';

test('a new image reading session restores the latest zero-based page', async () => {
  const connection = new NodeSqliteConnection();
  const book: Book<'images'> = {
    id: 'image-progress-book',
    title: 'Persistent images',
    format: 'images',
    fileUri: 'file:///documents/reebbon/books/image-progress-book',
    coverUri:
      'file:///documents/reebbon/books/image-progress-book/page-000001.jpg',
    totalPages: 205,
    createdAt: new Date('2026-09-10T08:00:00.000Z'),
  };

  try {
    await migrateDatabase(connection);
    const books = new SqliteBookRepository(connection);
    const repository = new SqliteReadingProgressRepository(connection);
    assert.deepEqual(await books.save(book), ok(undefined));

    const writingSession = createReadingProgressService({
      repository,
      now: () => new Date('2026-09-10T10:00:00.000Z'),
    });
    void writingSession.save(book, {
      position: { kind: 'images', index: 50 },
      completionRatio: 50 / 204,
    });
    void writingSession.save(book, {
      position: { kind: 'images', index: 120 },
      completionRatio: 120 / 204,
    });
    assert.deepEqual(await writingSession.flush(), ok(undefined));

    const reopenedSession = createReadingProgressService({
      repository,
      now: () => new Date('2026-09-10T11:00:00.000Z'),
    });
    assert.deepEqual(
      await reopenedSession.load(book),
      ok({
        position: { kind: 'images', index: 120 },
        completionRatio: 120 / 204,
      }),
    );
  } finally {
    await connection.close();
  }
});
