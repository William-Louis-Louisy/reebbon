/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  nativeDocumentPickerOptions,
  parsePickedDocument,
} from '../../src/infrastructure/importing/file-import-source-picker-core';

test('picker options request a readable local copy restricted to EPUB', () => {
  assert.deepEqual(
    nativeDocumentPickerOptions({ mimeTypes: ['application/epub+zip'] }),
    {
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/epub+zip'],
    },
  );
});

test('picker mapping validates a selected document into the common file source', () => {
  assert.deepEqual(
    parsePickedDocument({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/book.epub',
          name: 'book.epub',
          mimeType: 'application/epub+zip',
        },
      ],
    }),
    {
      ok: true,
      value: {
        kind: 'file',
        uri: 'file:///cache/book.epub',
        name: 'book.epub',
        mimeType: 'application/epub+zip',
      },
    },
  );
});

test('picker mapping treats cancellation as an expected empty selection', () => {
  assert.deepEqual(parsePickedDocument({ canceled: true, assets: null }), {
    ok: true,
    value: null,
  });
});

test('picker mapping rejects malformed native results', () => {
  assert.deepEqual(
    parsePickedDocument({
      canceled: false,
      assets: [{ uri: '', name: '' }],
    }),
    {
      ok: false,
      error: { kind: 'permission-or-access-failure' },
    },
  );
});
