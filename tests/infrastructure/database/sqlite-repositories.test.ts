/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { Book, Bookmark, ReadingProgress } from '../../../src/domain';
import { migrateDatabase } from '../../../src/infrastructure/database/migrations';
import { SqliteBookmarkRepository } from '../../../src/infrastructure/database/repositories/sqlite-bookmark-repository';
import { SqliteBookRepository } from '../../../src/infrastructure/database/repositories/sqlite-book-repository';
import { SqliteReadingProgressRepository } from '../../../src/infrastructure/database/repositories/sqlite-reading-progress-repository';

import { NodeSqliteConnection } from './node-sqlite-connection';

const createdAt = new Date('2026-09-01T08:00:00.000Z');
const updatedAt = new Date('2026-09-01T09:00:00.000Z');

function createBooks(): readonly Book[] {
  return [
    {
      id: 'epub-book',
      title: 'EPUB book',
      author: 'Author',
      format: 'epub',
      fileUri: 'file:///documents/reebbon/books/epub-book/book.epub',
      coverUri: 'file:///documents/reebbon/books/epub-book/cover.jpg',
      createdAt,
      lastOpenedAt: updatedAt,
    },
    {
      id: 'pdf-book',
      title: 'PDF book',
      format: 'pdf',
      fileUri: 'file:///documents/reebbon/books/pdf-book/book.pdf',
      totalPages: 48,
      createdAt,
    },
    {
      id: 'images-book',
      title: 'Image book',
      format: 'images',
      fileUri: 'file:///documents/reebbon/books/images-book/pages',
      totalPages: 200,
      createdAt,
    },
  ];
}

test('SQLite repositories round-trip books and every reader position', async () => {
  const connection = new NodeSqliteConnection();
  await migrateDatabase(connection);
  const books = new SqliteBookRepository(connection);
  const progressRepository = new SqliteReadingProgressRepository(connection);
  const bookmarks = new SqliteBookmarkRepository(connection);

  try {
    for (const book of createBooks()) {
      assert.equal((await books.save(book)).ok, true);
    }

    const progressRecords: readonly ReadingProgress[] = [
      {
        bookId: 'epub-book',
        position: { kind: 'epub', cfi: 'epubcfi(/6/2!/4/1:0)' },
        completionRatio: 0.1,
        updatedAt,
      },
      {
        bookId: 'pdf-book',
        position: { kind: 'pdf', page: 12 },
        completionRatio: 0.25,
        updatedAt,
      },
      {
        bookId: 'images-book',
        position: { kind: 'images', index: 99 },
        completionRatio: 0.5,
        updatedAt,
      },
    ];
    const bookmarkRecords: readonly Bookmark[] = progressRecords.map((progress, index) => ({
      id: `bookmark-${index}`,
      bookId: progress.bookId,
      position: progress.position,
      label: `Position ${index}`,
      createdAt: updatedAt,
    })) as readonly Bookmark[];

    for (const progress of progressRecords) {
      assert.equal((await progressRepository.save(progress)).ok, true);
    }
    for (const bookmark of bookmarkRecords) {
      assert.equal((await bookmarks.save(bookmark)).ok, true);
    }

    const listedBooks = await books.list();
    const epubProgress = await progressRepository.getByBookId('epub-book');
    const pdfProgress = await progressRepository.getByBookId('pdf-book');
    const imageBookmarks = await bookmarks.listByBookId('images-book');

    assert.equal(listedBooks.ok && listedBooks.value.length, 3);
    assert.deepEqual(
      epubProgress.ok && epubProgress.value?.position,
      { kind: 'epub', cfi: 'epubcfi(/6/2!/4/1:0)' },
    );
    assert.deepEqual(
      pdfProgress.ok && pdfProgress.value?.position,
      { kind: 'pdf', page: 12 },
    );
    assert.deepEqual(
      imageBookmarks.ok && imageBookmarks.value[0]?.position,
      { kind: 'images', index: 99 },
    );

    const storedEpub = await books.getById('epub-book');
    assert.equal(storedEpub.ok && storedEpub.value?.author, 'Author');
    assert.equal(
      storedEpub.ok && storedEpub.value?.lastOpenedAt?.toISOString(),
      updatedAt.toISOString(),
    );
  } finally {
    await connection.close();
  }
});

test('SQLite constraints reject mismatched formats and repositories reject invalid domain values', async () => {
  const connection = new NodeSqliteConnection();
  await migrateDatabase(connection);
  const books = new SqliteBookRepository(connection);
  const progress = new SqliteReadingProgressRepository(connection);

  try {
    const pdfBook = createBooks()[1];
    assert.ok(pdfBook);
    await books.save(pdfBook);

    const formatMismatch: ReadingProgress = {
      bookId: pdfBook.id,
      position: { kind: 'epub', cfi: 'epubcfi(/6/2)' },
      completionRatio: 0.5,
      updatedAt,
    };
    const invalidRatio: ReadingProgress = {
      bookId: pdfBook.id,
      position: { kind: 'pdf', page: 2 },
      completionRatio: Number.NaN,
      updatedAt,
    };

    assert.deepEqual(await progress.save(formatMismatch), {
      ok: false,
      error: { kind: 'persistence-failure', operation: 'write' },
    });
    assert.deepEqual(await progress.save(invalidRatio), {
      ok: false,
      error: { kind: 'persistence-failure', operation: 'write' },
    });
  } finally {
    await connection.close();
  }
});

test('book deletion cascades reading data and malformed rows never enter the domain', async () => {
  const connection = new NodeSqliteConnection();
  await migrateDatabase(connection);
  const books = new SqliteBookRepository(connection);
  const progress = new SqliteReadingProgressRepository(connection);
  const bookmarks = new SqliteBookmarkRepository(connection);

  try {
    const pdfBook = createBooks()[1];
    assert.ok(pdfBook);
    await books.save(pdfBook);
    await progress.save({
      bookId: pdfBook.id,
      position: { kind: 'pdf', page: 2 },
      completionRatio: 0.2,
      updatedAt,
    });
    await bookmarks.save({
      id: 'bookmark-cascade',
      bookId: pdfBook.id,
      position: { kind: 'pdf', page: 2 },
      createdAt: updatedAt,
    });

    await connection.run(
      `UPDATE reading_progress SET position_value = 'not-a-page' WHERE book_id = ?`,
      [pdfBook.id],
    );
    assert.deepEqual(await progress.getByBookId(pdfBook.id), {
      ok: false,
      error: { kind: 'persistence-failure', operation: 'read' },
    });

    assert.equal((await books.delete(pdfBook.id)).ok, true);
    assert.deepEqual(await progress.getByBookId(pdfBook.id), { ok: true, value: null });
    assert.deepEqual(await bookmarks.listByBookId(pdfBook.id), { ok: true, value: [] });
  } finally {
    await connection.close();
  }
});
