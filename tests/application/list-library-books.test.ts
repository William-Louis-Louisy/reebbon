/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createListLibraryBooks } from '../../src/application';
import { err, ok, type Book, type ReadingProgress } from '../../src/domain';

const firstBook: Book = {
  id: 'book-1',
  title: 'Les Villes invisibles',
  author: 'Italo Calvino',
  format: 'epub',
  fileUri: 'file:///books/book-1/book.epub',
  createdAt: new Date('2026-09-01T08:00:00.000Z'),
};

const secondBook: Book = {
  id: 'book-2',
  title: 'Rapport annuel',
  format: 'pdf',
  fileUri: 'file:///books/book-2/book.pdf',
  createdAt: new Date('2026-08-31T08:00:00.000Z'),
};

const firstProgress: ReadingProgress = {
  bookId: firstBook.id,
  position: { kind: 'epub', cfi: 'epubcfi(/6/4)' },
  completionRatio: 0.62,
  updatedAt: new Date('2026-09-01T09:00:00.000Z'),
};

test('list library books combines repository books with optional progress', async () => {
  const requestedBookIds: string[] = [];
  const listLibraryBooks = createListLibraryBooks({
    books: {
      list: () => Promise.resolve(ok([firstBook, secondBook])),
    },
    readingProgress: {
      getByBookId: (bookId) => {
        requestedBookIds.push(bookId);
        return Promise.resolve(ok(bookId === firstBook.id ? firstProgress : null));
      },
    },
  });

  const result = await listLibraryBooks();

  assert.deepEqual(requestedBookIds, [firstBook.id, secondBook.id]);
  assert.deepEqual(result, {
    ok: true,
    value: [
      { book: firstBook, progress: 0.62 },
      { book: secondBook, progress: 0 },
    ],
  });
});

test('list library books returns typed repository failures', async () => {
  const repositoryError = {
    kind: 'persistence-failure',
    operation: 'read',
  } as const;
  const listLibraryBooks = createListLibraryBooks({
    books: {
      list: () => Promise.resolve(ok([firstBook])),
    },
    readingProgress: {
      getByBookId: () => Promise.resolve(err(repositoryError)),
    },
  });

  assert.deepEqual(await listLibraryBooks(), err(repositoryError));
});
