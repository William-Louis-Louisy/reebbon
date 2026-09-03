/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createReadingProgressService } from '../../src/application';
import { ok, type Book } from '../../src/domain';
import { migrateDatabase } from '../../src/infrastructure/database/migrations';
import { SqliteBookRepository } from '../../src/infrastructure/database/repositories/sqlite-book-repository';
import { SqliteReadingProgressRepository } from '../../src/infrastructure/database/repositories/sqlite-reading-progress-repository';
import { NodeSqliteConnection } from '../infrastructure/database/node-sqlite-connection';

test('a new EPUB reading session restores the latest SQLite position', async () => {
  const connection = new NodeSqliteConnection();
  const book: Book<'epub'> = {
    id: 'epub-progress-book',
    title: 'Persistent Reader',
    format: 'epub',
    fileUri: 'file:///documents/reebbon/books/epub-progress-book/book.epub',
    createdAt: new Date('2026-09-03T08:00:00.000Z'),
  };

  try {
    await migrateDatabase(connection);
    const books = new SqliteBookRepository(connection);
    const repository = new SqliteReadingProgressRepository(connection);
    assert.deepEqual(await books.save(book), ok(undefined));

    const writingSession = createReadingProgressService({
      repository,
      now: () => new Date('2026-09-03T10:00:00.000Z'),
    });
    void writingSession.save(book, {
      position: { kind: 'epub', cfi: 'epubcfi(/6/2!/4/2)' },
      completionRatio: 0.1,
    });
    void writingSession.save(book, {
      position: { kind: 'epub', cfi: 'epubcfi(/6/8!/4/2)' },
      completionRatio: 0.4,
    });
    assert.deepEqual(await writingSession.flush(), ok(undefined));

    const reopenedSession = createReadingProgressService({
      repository,
      now: () => new Date('2026-09-03T11:00:00.000Z'),
    });
    assert.deepEqual(await reopenedSession.load(book), ok({
      position: { kind: 'epub', cfi: 'epubcfi(/6/8!/4/2)' },
      completionRatio: 0.4,
    }));
  } finally {
    await connection.close();
  }
});
