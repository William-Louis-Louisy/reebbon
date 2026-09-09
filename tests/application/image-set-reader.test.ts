/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createImageSetReader,
  imageSetReaderCapabilities,
  type ImageSetRendition,
} from '../../src/application';
import { err, ok, type Book } from '../../src/domain';

const book: Book<'images'> = {
  id: 'image-book',
  title: 'Sequential art',
  format: 'images',
  fileUri: 'file:///documents/reebbon/books/image-book',
  coverUri:
    'file:///documents/reebbon/books/image-book/page-000001.jpg',
  totalPages: 5,
  createdAt: new Date('2026-09-10T12:00:00.000Z'),
};

function createRendition() {
  const calls: string[] = [];
  let location = { index: 0, totalPages: 5 };
  const rendition: ImageSetRendition = {
    open(contentUri, totalPages, initialIndex) {
      calls.push(`open:${contentUri}:${totalPages}:${initialIndex ?? 'start'}`);
      location = { index: initialIndex ?? 0, totalPages };
      return Promise.resolve(ok(undefined));
    },
    goTo(index) {
      calls.push(`go-to:${index}`);
      location = { ...location, index };
      return Promise.resolve(ok(undefined));
    },
    getLocation() {
      calls.push('get-location');
      return Promise.resolve(ok(location));
    },
    close() {
      calls.push('close');
      return Promise.resolve(ok(undefined));
    },
  };
  return {
    calls,
    rendition,
    setLocation(value: typeof location) {
      location = value;
    },
  };
}

test('image reader implements the common lifecycle with zero-based progress', async () => {
  const harness = createRendition();
  const reader = createImageSetReader(harness.rendition);
  const initial = { kind: 'images', index: 1 } as const;
  const target = { kind: 'images', index: 2 } as const;

  assert.deepEqual(await reader.open(book, initial), ok(undefined));
  assert.deepEqual(await reader.goTo(target), ok(undefined));
  assert.deepEqual(await reader.getProgress(), {
    ok: true,
    value: { position: target, completionRatio: 0.5 },
  });
  assert.deepEqual(await reader.setTheme('night'), ok(undefined));
  assert.deepEqual(await reader.close(), ok(undefined));
  assert.deepEqual(harness.calls, [
    `open:${book.fileUri}:5:1`,
    'go-to:2',
    'get-location',
    'close',
  ]);
  assert.deepEqual(reader.capabilities, imageSetReaderCapabilities);
  assert.equal(reader.capabilities.zoom, true);
  assert.equal(reader.capabilities.readingThemeCustomization, false);
  assert.equal(reader.capabilities.configurableReadingDirection, false);
  assert.equal(reader.capabilities.doublePage, false);
});

test('image reader validates local content, page count and index bounds', async () => {
  const harness = createRendition();
  const reader = createImageSetReader(harness.rendition);

  assert.deepEqual(
    await reader.open({ ...book, fileUri: 'https://example.com/book' }),
    err({ kind: 'content-access-failure' }),
  );
  assert.deepEqual(
    await reader.open({ ...book, totalPages: undefined }),
    err({ kind: 'content-access-failure' }),
  );
  assert.deepEqual(
    await reader.open(book, { kind: 'images', index: 5 }),
    err({
      kind: 'invalid-position',
      position: { kind: 'images', index: 5 },
    }),
  );
  assert.deepEqual(
    await reader.goTo({ kind: 'images', index: 0 }),
    err({ kind: 'not-open' }),
  );
  assert.deepEqual(harness.calls, []);

  await reader.open(book);
  assert.deepEqual(
    await reader.goTo({ kind: 'images', index: -1 }),
    err({
      kind: 'invalid-position',
      position: { kind: 'images', index: -1 },
    }),
  );
  assert.deepEqual(
    await reader.goTo({ kind: 'images', index: 5 }),
    err({
      kind: 'invalid-position',
      position: { kind: 'images', index: 5 },
    }),
  );
});

test('image reader rejects malformed rendition locations and handles one page', async () => {
  const harness = createRendition();
  const reader = createImageSetReader(harness.rendition);
  await reader.open(book);

  harness.setLocation({ index: 5, totalPages: 5 });
  assert.deepEqual(
    await reader.getProgress(),
    err({ kind: 'rendering-failure' }),
  );

  await reader.close();
  await reader.open({ ...book, totalPages: 1 });
  harness.setLocation({ index: 0, totalPages: 1 });
  assert.deepEqual(await reader.getProgress(), {
    ok: true,
    value: {
      position: { kind: 'images', index: 0 },
      completionRatio: 1,
    },
  });
});

test('image reader converts unexpected rendition failures into typed errors', async () => {
  const harness = createRendition();
  harness.rendition.open = async () => {
    throw new Error('Native image renderer unavailable.');
  };
  const reader = createImageSetReader(harness.rendition);

  assert.deepEqual(
    await reader.open(book),
    err({ kind: 'rendering-failure' }),
  );
  assert.deepEqual(await reader.close(), ok(undefined));
  assert.deepEqual(harness.calls, ['close']);
});
