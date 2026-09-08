/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPdfReader,
  pdfReaderCapabilities,
  type PdfRendition,
} from '../../src/application';
import { err, ok, type Book } from '../../src/domain';

const book: Book<'pdf'> = {
  id: 'pdf-book',
  title: 'Native PDF',
  format: 'pdf',
  fileUri: 'file:///documents/reebbon/books/pdf-book/book.pdf',
  totalPages: 5,
  createdAt: new Date('2026-09-07T12:00:00.000Z'),
};

function createRendition() {
  const calls: string[] = [];
  let location = { page: 1, totalPages: 5 };
  const rendition: PdfRendition = {
    open(fileUri, initialPage) {
      calls.push(`open:${fileUri}:${initialPage ?? 'start'}`);
      location = { ...location, page: initialPage ?? 1 };
      return Promise.resolve(ok(undefined));
    },
    goTo(page) {
      calls.push(`go-to:${page}`);
      location = { ...location, page };
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
  return { calls, rendition, setLocation: (value: typeof location) => { location = value; } };
}

test('PDF reader implements the common lifecycle with one-based page progress', async () => {
  const harness = createRendition();
  const reader = createPdfReader(harness.rendition);
  const initial = { kind: 'pdf', page: 2 } as const;
  const target = { kind: 'pdf', page: 3 } as const;

  assert.deepEqual(await reader.open(book, initial), ok(undefined));
  assert.deepEqual(await reader.goTo(target), ok(undefined));
  assert.deepEqual(await reader.getProgress(), {
    ok: true,
    value: { position: target, completionRatio: 0.5 },
  });
  assert.deepEqual(await reader.setTheme('night'), ok(undefined));
  assert.deepEqual(await reader.close(), ok(undefined));
  assert.deepEqual(harness.calls, [
    `open:${book.fileUri}:2`,
    'go-to:3',
    'get-location',
    'close',
  ]);
  assert.deepEqual(reader.capabilities, pdfReaderCapabilities);
  assert.equal(reader.capabilities.readingThemeCustomization, false);
  assert.equal(reader.capabilities.zoom, true);
});

test('PDF reader validates local content and page bounds before rendering', async () => {
  const harness = createRendition();
  const reader = createPdfReader(harness.rendition);

  assert.deepEqual(
    await reader.open({ ...book, fileUri: 'https://example.com/book.pdf' }),
    err({ kind: 'content-access-failure' }),
  );
  assert.deepEqual(
    await reader.open(book, { kind: 'pdf', page: 6 }),
    err({ kind: 'invalid-position', position: { kind: 'pdf', page: 6 } }),
  );
  assert.deepEqual(await reader.goTo({ kind: 'pdf', page: 1 }), err({ kind: 'not-open' }));
  assert.deepEqual(await reader.setTheme('paper'), err({ kind: 'not-open' }));
  assert.deepEqual(harness.calls, []);

  await reader.open(book);
  assert.deepEqual(
    await reader.goTo({ kind: 'pdf', page: 0 }),
    err({ kind: 'invalid-position', position: { kind: 'pdf', page: 0 } }),
  );
  assert.deepEqual(
    await reader.goTo({ kind: 'pdf', page: 6 }),
    err({ kind: 'invalid-position', position: { kind: 'pdf', page: 6 } }),
  );
});

test('PDF reader rejects malformed native locations and handles a single-page PDF', async () => {
  const harness = createRendition();
  const reader = createPdfReader(harness.rendition);
  await reader.open({ ...book, totalPages: undefined });
  harness.setLocation({ page: 7, totalPages: 5 });
  assert.deepEqual(await reader.getProgress(), err({ kind: 'rendering-failure' }));

  harness.setLocation({ page: 1, totalPages: 1 });
  assert.deepEqual(await reader.getProgress(), {
    ok: true,
    value: {
      position: { kind: 'pdf', page: 1 },
      completionRatio: 1,
    },
  });
});

test('PDF reader converts unexpected native failures into typed errors', async () => {
  const harness = createRendition();
  harness.rendition.open = async () => {
    throw new Error('Native renderer unavailable.');
  };
  const reader = createPdfReader(harness.rendition);

  assert.deepEqual(await reader.open(book), err({ kind: 'rendering-failure' }));
  assert.deepEqual(await reader.close(), ok(undefined));
  assert.deepEqual(harness.calls, ['close']);
});
