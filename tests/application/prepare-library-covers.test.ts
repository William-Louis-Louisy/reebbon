/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  prepareLibraryCovers,
  type LibraryBookItem,
  type LibraryCoverThumbnailProvider,
} from '../../src/application';
import { err, ok } from '../../src/domain';

function item(id: string, coverUri?: string): LibraryBookItem {
  return {
    book: {
      id,
      title: `Book ${id}`,
      format: 'images',
      fileUri: `file:///books/${id}`,
      ...(coverUri === undefined ? {} : { coverUri }),
      createdAt: new Date('2026-09-14T12:00:00.000Z'),
    },
    progress: 0,
  };
}

test('library covers are prepared sequentially and replace full-resolution URIs', async () => {
  let active = 0;
  let maximumActive = 0;
  const calls: string[] = [];
  const provider: LibraryCoverThumbnailProvider = {
    async prepare(bookId, sourceUri) {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      calls.push(`${bookId}:${sourceUri}`);
      await Promise.resolve();
      active -= 1;
      return ok({ uri: `file:///books/${bookId}/library-cover-thumbnail.jpg` });
    },
  };

  const prepared = await prepareLibraryCovers(
    [item('one', 'file:///books/one/page-000001.jpg'), item('none'), item('two', 'file:///books/two/cover.jpg')],
    provider,
  );

  assert.equal(maximumActive, 1);
  assert.deepEqual(calls, [
    'one:file:///books/one/page-000001.jpg',
    'two:file:///books/two/cover.jpg',
  ]);
  assert.equal(
    prepared[0]?.book.coverUri,
    'file:///books/one/library-cover-thumbnail.jpg',
  );
  assert.equal(prepared[1]?.book.coverUri, undefined);
  assert.equal(
    prepared[2]?.book.coverUri,
    'file:///books/two/library-cover-thumbnail.jpg',
  );
});

test('an unavailable thumbnail never falls back to decoding the original cover', async () => {
  const original = 'file:///books/one/full-resolution.jpg';
  const provider: LibraryCoverThumbnailProvider = {
    prepare: async () => err({ kind: 'thumbnail-unavailable' }),
  };

  const prepared = await prepareLibraryCovers([item('one', original)], provider);

  assert.equal(prepared[0]?.book.coverUri, undefined);
  assert.equal(prepared[0]?.book.fileUri, 'file:///books/one');
});

test('a thrown thumbnail boundary error is isolated from library loading', async () => {
  const provider: LibraryCoverThumbnailProvider = {
    prepare: async () => {
      throw new Error('native module unavailable');
    },
  };

  const prepared = await prepareLibraryCovers(
    [item('one', 'file:///books/one/cover.jpg')],
    provider,
  );

  assert.equal(prepared.length, 1);
  assert.equal(prepared[0]?.book.coverUri, undefined);
});
