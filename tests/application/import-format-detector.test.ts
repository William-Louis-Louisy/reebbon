/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createImportFormatDetector,
  type ImportFileReader,
} from '../../src/application';
import { err, ok } from '../../src/domain';

function createReader(
  files: Readonly<Record<string, readonly number[]>>,
): ImportFileReader & { readonly prefixReads: string[] } {
  const prefixReads: string[] = [];
  return {
    prefixReads,
    readPrefix(uri, byteLength) {
      prefixReads.push(uri);
      const bytes = files[uri];
      return Promise.resolve(
        bytes === undefined
          ? err({ kind: 'permission-or-access-failure' })
          : ok(Uint8Array.from(bytes.slice(0, byteLength))),
      );
    },
    readAll() {
      throw new Error('Not used by format detection.');
    },
  };
}

test('format detector combines source declarations with EPUB and PDF signatures', async () => {
  const reader = createReader({
    'file:///book': [0x50, 0x4b, 0x03, 0x04],
    'file:///document': [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37],
  });
  const detector = createImportFormatDetector({ files: reader });

  assert.deepEqual(
    await detector.detect({
      kind: 'file',
      uri: 'file:///book',
      name: 'book.epub',
      mimeType: 'application/octet-stream',
    }),
    { ok: true, value: 'epub' },
  );
  assert.deepEqual(
    await detector.detect({
      kind: 'file',
      uri: 'file:///document',
      name: 'download',
      mimeType: 'application/pdf',
    }),
    { ok: true, value: 'pdf' },
  );
});

test('format detector recognizes image directories without reading a file', async () => {
  const reader = createReader({});
  const detector = createImportFormatDetector({ files: reader });

  assert.deepEqual(
    await detector.detect({
      kind: 'directory',
      uri: 'file:///images',
      name: 'Volume 1',
    }),
    { ok: true, value: 'image-directory' },
  );
  assert.deepEqual(reader.prefixReads, []);
});

test('format detector prepares CBZ reuse while keeping ZIP formats distinct', async () => {
  const reader = createReader({
    'file:///comic': [0x50, 0x4b, 0x05, 0x06],
  });
  const detector = createImportFormatDetector({ files: reader });

  assert.deepEqual(
    await detector.detect({
      kind: 'file',
      uri: 'file:///comic',
      name: 'comic.cbz',
    }),
    { ok: true, value: 'cbz' },
  );
});

test('format detector types mismatched signatures and inaccessible files', async () => {
  const reader = createReader({
    'file:///fake': [0x25, 0x50, 0x44, 0x46, 0x2d],
  });
  const detector = createImportFormatDetector({ files: reader });
  const fakeEpub = {
    kind: 'file',
    uri: 'file:///fake',
    name: 'fake.epub',
  } as const;
  const missing = {
    kind: 'file',
    uri: 'file:///missing',
    name: 'missing.epub',
  } as const;

  assert.deepEqual(await detector.detect(fakeEpub), {
    ok: false,
    error: { kind: 'corrupted-source', format: 'epub' },
  });
  assert.deepEqual(await detector.detect(missing), {
    ok: false,
    error: { kind: 'permission-or-access-failure', source: missing },
  });
  assert.deepEqual(
    await detector.detect({
      kind: 'file',
      uri: 'file:///unknown',
      name: 'unknown.mobi',
    }),
    {
      ok: false,
      error: { kind: 'unsupported-format', detectedFormat: 'mobi' },
    },
  );
});

test('format detector converts unexpected reader failures into typed access errors', async () => {
  const detector = createImportFormatDetector({
    files: {
      readPrefix() {
        throw new Error('Opaque native failure.');
      },
    },
  });
  const source = {
    kind: 'file',
    uri: 'content://provider/book.epub',
    name: 'book.epub',
  } as const;

  assert.deepEqual(await detector.detect(source), {
    ok: false,
    error: { kind: 'permission-or-access-failure', source },
  });
});
