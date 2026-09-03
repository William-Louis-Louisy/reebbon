/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEpubReader,
  epubReaderCapabilities,
  type EpubRendition,
} from '../../src/application';
import {
  defaultReaderFontSize,
  err,
  ok,
  parseReaderFontSize,
  type Book,
  type ReaderFontSize,
} from '../../src/domain';

const book: Book<'epub'> = {
  id: 'book-1',
  title: 'Reader Contract',
  format: 'epub',
  fileUri: 'file:///documents/reebbon/books/book-1/book.epub',
  createdAt: new Date('2026-09-02T12:00:00.000Z'),
};

function createRendition() {
  const calls: string[] = [];
  let location = {
    cfi: 'epubcfi(/6/2!/4/2/2)',
    completionRatio: 0,
  };
  const rendition: EpubRendition = {
    open(fileUri, initialCfi) {
      calls.push(`open:${fileUri}:${initialCfi ?? 'start'}`);
      if (initialCfi !== undefined) {
        location = { cfi: initialCfi, completionRatio: 0.4 };
      }
      return Promise.resolve(ok(undefined));
    },
    goTo(cfi) {
      calls.push(`go-to:${cfi}`);
      location = { cfi, completionRatio: 1.4 };
      return Promise.resolve(ok(undefined));
    },
    getLocation() {
      calls.push('get-location');
      return Promise.resolve(ok(location));
    },
    getTableOfContents() {
      calls.push('get-table-of-contents');
      return Promise.resolve(ok([
        { id: 'toc-0', label: 'Partie I', depth: 0 },
        { id: 'toc-1', label: 'Chapitre 1', depth: 1 },
      ]));
    },
    goToTableOfContentsEntry(entryId) {
      calls.push(`go-to-table-of-contents:${entryId}`);
      return Promise.resolve(ok(undefined));
    },
    setTheme(theme) {
      calls.push(`theme:${theme}`);
      return Promise.resolve(ok(undefined));
    },
    setFontSize(fontSize) {
      calls.push(`font-size:${fontSize}`);
      return Promise.resolve(ok(undefined));
    },
    close() {
      calls.push('close');
      return Promise.resolve(ok(undefined));
    },
  };

  return { calls, rendition };
}

test('EPUB reader implements the common lifecycle and reports typed CFI progress', async () => {
  const harness = createRendition();
  const reader = createEpubReader(harness.rendition);
  const initial = { kind: 'epub', cfi: 'epubcfi(/6/4!/4/2/2)' } as const;
  const target = { kind: 'epub', cfi: 'epubcfi(/6/8!/4/2/2)' } as const;

  assert.deepEqual(await reader.open(book, initial), ok(undefined));
  assert.deepEqual(await reader.goTo(target), ok(undefined));
  assert.deepEqual(await reader.setTheme('paper'), ok(undefined));
  assert.deepEqual(await reader.setTheme('sepia'), ok(undefined));
  assert.deepEqual(await reader.setTheme('night'), ok(undefined));
  const customization = reader.fontCustomization;
  assert.notEqual(customization, undefined);
  if (customization === undefined) {
    return;
  }
  const fontSize = parseReaderFontSize(20);
  assert.equal(fontSize.ok, true);
  if (!fontSize.ok) {
    return;
  }
  assert.deepEqual(await customization.setFontSize(fontSize.value), ok(undefined));
  assert.deepEqual(await reader.getProgress(), {
    ok: true,
    value: { position: target, completionRatio: 1 },
  });
  assert.deepEqual(await reader.close(), ok(undefined));
  assert.deepEqual(harness.calls, [
    `open:${book.fileUri}:${initial.cfi}`,
    `go-to:${target.cfi}`,
    'theme:paper',
    'theme:sepia',
    'theme:night',
    'font-size:20',
    'get-location',
    'close',
  ]);
  assert.deepEqual(reader.capabilities, epubReaderCapabilities);
});

test('EPUB table of contents is exposed and navigated through the Reader capability', async () => {
  const harness = createRendition();
  const reader = createEpubReader(harness.rendition);
  const tableOfContents = reader.tableOfContents;

  assert.notEqual(tableOfContents, undefined);
  if (tableOfContents === undefined) {
    return;
  }

  assert.deepEqual(await tableOfContents.getEntries(), err({ kind: 'not-open' }));
  await reader.open(book);
  assert.deepEqual(await tableOfContents.getEntries(), ok([
    { id: 'toc-0', label: 'Partie I', depth: 0 },
    { id: 'toc-1', label: 'Chapitre 1', depth: 1 },
  ]));
  assert.deepEqual(
    await tableOfContents.goToEntry('unknown'),
    err({
      kind: 'invalid-table-of-contents-entry',
      entryId: 'unknown',
    }),
  );
  assert.deepEqual(await tableOfContents.goToEntry('toc-1'), ok(undefined));
  assert.deepEqual(harness.calls, [
    `open:${book.fileUri}:start`,
    'get-table-of-contents',
    'go-to-table-of-contents:toc-1',
  ]);
});

test('EPUB reader rejects invalid content and positions before touching the rendition', async () => {
  const harness = createRendition();
  const reader = createEpubReader(harness.rendition);

  assert.deepEqual(
    await reader.open({ ...book, fileUri: 'https://example.com/book.epub' }),
    err({ kind: 'content-access-failure' }),
  );
  assert.deepEqual(
    await reader.open(book, { kind: 'epub', cfi: 'chapter-1' }),
    err({
      kind: 'invalid-position',
      position: { kind: 'epub', cfi: 'chapter-1' },
    }),
  );
  assert.deepEqual(await reader.getProgress(), err({ kind: 'not-open' }));
  const customization = reader.fontCustomization;
  assert.notEqual(customization, undefined);
  if (customization === undefined) {
    return;
  }
  assert.deepEqual(
    await customization.setFontSize(defaultReaderFontSize),
    err({ kind: 'not-open' }),
  );
  await reader.open(book);
  assert.deepEqual(
    await customization.setFontSize(48 as ReaderFontSize),
    err({ kind: 'invalid-font-size', fontSize: 48 }),
  );
  assert.deepEqual(harness.calls, [`open:${book.fileUri}:start`]);
});

test('EPUB reader converts unexpected renderer failures into typed errors', async () => {
  const harness = createRendition();
  harness.rendition.open = () => Promise.reject(new Error('WebView failed'));
  const reader = createEpubReader(harness.rendition);

  assert.deepEqual(
    await reader.open(book),
    err({ kind: 'rendering-failure' }),
  );
  assert.deepEqual(await reader.close(), ok(undefined));
  assert.deepEqual(harness.calls, ['close']);
});
