/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { LibraryBookItem } from '../../src/application';
import type { Book } from '../../src/domain';
import { updateLibraryBookProgress } from '../../src/presentation/screens/library/library-progress';

const firstBook: Book<'epub'> = {
  id: 'book-1',
  title: 'Premier livre',
  format: 'epub',
  fileUri: 'file:///books/book-1/book.epub',
  createdAt: new Date('2026-09-07T08:00:00.000Z'),
};

const secondBook: Book<'pdf'> = {
  id: 'book-2',
  title: 'Second livre',
  format: 'pdf',
  fileUri: 'file:///books/book-2/book.pdf',
  createdAt: new Date('2026-09-07T09:00:00.000Z'),
};

test('updates only the matching library item for frequent reader progress', () => {
  const items: readonly LibraryBookItem[] = [
    { book: firstBook, progress: 0.1 },
    { book: secondBook, progress: 0.2 },
  ];

  const updated = updateLibraryBookProgress(items, firstBook.id, 0.65);

  assert.notEqual(updated, items);
  assert.notEqual(updated[0], items[0]);
  assert.equal(updated[1], items[1]);
  assert.deepEqual(updated[0], { book: firstBook, progress: 0.65 });
});

test('preserves list identity when no card needs an update', () => {
  const items: readonly LibraryBookItem[] = [
    { book: firstBook, progress: 0.5 },
  ];

  assert.equal(updateLibraryBookProgress(items, firstBook.id, 0.5), items);
  assert.equal(updateLibraryBookProgress(items, 'missing', 0.8), items);
});

test('normalizes untrusted progress before publishing it to a card', () => {
  const items: readonly LibraryBookItem[] = [
    { book: firstBook, progress: 0.5 },
  ];

  assert.equal(
    updateLibraryBookProgress(items, firstBook.id, Number.NaN)[0]?.progress,
    0,
  );
  assert.equal(
    updateLibraryBookProgress(items, firstBook.id, 4)[0]?.progress,
    1,
  );
});
