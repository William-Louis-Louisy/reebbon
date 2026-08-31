/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  BookRepository,
  BookmarkRepository,
  ReadingProgressRepository,
} from '../../src/application';
import {
  ok,
  type Book,
  type Bookmark,
  type ReadingProgress,
} from '../../src/domain';

test('library and progress repositories are implementable as framework-free ports', async () => {
  const book: Book<'pdf'> = {
    id: 'book-1',
    title: 'Repository contract',
    format: 'pdf',
    fileUri: 'file:///library/book-1/document.pdf',
    createdAt: new Date('2026-08-31T10:00:00.000Z'),
  };
  const progress: ReadingProgress = {
    bookId: book.id,
    position: { kind: 'pdf', page: 8 },
    completionRatio: 0.25,
    updatedAt: new Date('2026-08-31T11:00:00.000Z'),
  };
  const bookmark: Bookmark = {
    id: 'bookmark-1',
    bookId: book.id,
    position: { kind: 'pdf', page: 8 },
    createdAt: new Date('2026-08-31T11:00:00.000Z'),
  };

  const books: BookRepository = {
    async getById(id) {
      return ok(id === book.id ? book : null);
    },
    async list() {
      return ok([book]);
    },
    async save(_book) {
      return ok(undefined);
    },
    async delete(_id) {
      return ok(undefined);
    },
  };
  const progressRepository: ReadingProgressRepository = {
    async getByBookId(bookId) {
      return ok(bookId === book.id ? progress : null);
    },
    async save(_progress) {
      return ok(undefined);
    },
    async deleteByBookId(_bookId) {
      return ok(undefined);
    },
  };
  const bookmarks: BookmarkRepository = {
    async listByBookId(bookId) {
      return ok(bookId === book.id ? [bookmark] : []);
    },
    async save(_bookmark) {
      return ok(undefined);
    },
    async delete(_id) {
      return ok(undefined);
    },
    async deleteByBookId(_bookId) {
      return ok(undefined);
    },
  };

  const foundBook = await books.getById(book.id);
  const foundProgress = await progressRepository.getByBookId(book.id);
  const foundBookmarks = await bookmarks.listByBookId(book.id);

  assert.equal(foundBook.ok && foundBook.value?.format, 'pdf');
  assert.equal(
    foundProgress.ok && foundProgress.value?.position.kind,
    'pdf',
  );
  assert.equal(foundBookmarks.ok && foundBookmarks.value.length, 1);
});
