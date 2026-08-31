/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { Reader } from '../../src/application';
import {
  err,
  ok,
  type Book,
  type PdfReaderPosition,
  type ReadingTheme,
} from '../../src/domain';

test('a format adapter can implement the common Reader contract without framework dependencies', async () => {
  let position: PdfReaderPosition | undefined;
  let selectedTheme: ReadingTheme = 'paper';

  const reader: Reader<'pdf'> = {
    format: 'pdf',
    capabilities: {
      tableOfContents: true,
      continuousScroll: true,
      fontCustomization: false,
      zoom: true,
      configurableReadingDirection: false,
      doublePage: false,
    },
    async open(_book, initialPosition) {
      position = initialPosition ?? { kind: 'pdf', page: 1 };
      return ok(undefined);
    },
    async goTo(nextPosition) {
      position = nextPosition;
      return ok(undefined);
    },
    async getProgress() {
      return position
        ? ok({ position, completionRatio: position.page / 100 })
        : err({ kind: 'not-open' });
    },
    async setTheme(theme) {
      selectedTheme = theme;
      return ok(undefined);
    },
    async close() {
      position = undefined;
      return ok(undefined);
    },
  };

  const book: Book<'pdf'> = {
    id: 'book-1',
    title: 'A PDF',
    format: 'pdf',
    fileUri: 'file:///library/book-1/document.pdf',
    createdAt: new Date('2026-08-31T10:00:00.000Z'),
  };

  await reader.open(book, { kind: 'pdf', page: 4 });
  await reader.goTo({ kind: 'pdf', page: 12 });
  await reader.setTheme('night');
  const progress = await reader.getProgress();

  assert.equal(reader.format, 'pdf');
  assert.equal(reader.capabilities.zoom, true);
  assert.equal(reader.capabilities.fontCustomization, false);
  assert.equal(selectedTheme, 'night');
  assert.equal(progress.ok, true);
  if (progress.ok) {
    assert.deepEqual(progress.value.position, { kind: 'pdf', page: 12 });
    assert.equal(progress.value.completionRatio, 0.12);
  }
});
