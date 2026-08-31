/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readerFormatForImportFormat,
  type Importer,
} from '../../src/application';
import { ok, type Book } from '../../src/domain';

test('import formats resolve to reader formats without exposing archive formats to Reader', () => {
  assert.equal(readerFormatForImportFormat('epub'), 'epub');
  assert.equal(readerFormatForImportFormat('pdf'), 'pdf');
  assert.equal(readerFormatForImportFormat('image-directory'), 'images');
  assert.equal(readerFormatForImportFormat('cbz'), 'images');
});

test('a CBZ importer returns an image-set book through the common importer port', async () => {
  const imageBook: Book<'images'> = {
    id: 'book-cbz',
    title: 'Archive volume',
    format: 'images',
    fileUri: 'file:///library/book-cbz/pages',
    totalPages: 24,
    createdAt: new Date('2026-08-31T10:00:00.000Z'),
  };

  const importer: Importer<'cbz'> = {
    format: 'cbz',
    async importBook(source) {
      assert.equal(source.kind, 'file');
      return ok({ book: imageBook });
    },
  };

  const result = await importer.importBook({
    kind: 'file',
    uri: 'file:///incoming/volume.cbz',
    name: 'volume.cbz',
    mimeType: 'application/vnd.comicbook+zip',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.book.format, 'images');
    assert.equal(result.value.book.totalPages, 24);
  }
});
