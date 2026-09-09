/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseDirectoryEntries,
} from '../../src/infrastructure/importing/import-directory-reader-core';

test('directory reader validates native files and directories', () => {
  assert.deepEqual(parseDirectoryEntries([
    { kind: 'file', uri: 'content://tree/comic/001.jpg', name: '001.jpg' },
    { kind: 'directory', uri: 'content://tree/comic/extras', name: 'extras' },
  ]), {
    ok: true,
    value: [
      { kind: 'file', uri: 'content://tree/comic/001.jpg', name: '001.jpg' },
      { kind: 'directory', uri: 'content://tree/comic/extras', name: 'extras' },
    ],
  });
});

test('directory reader rejects malformed native entries', () => {
  assert.deepEqual(
    parseDirectoryEntries([{ kind: 'file', uri: '', name: '001.jpg' }]),
    {
      ok: false,
      error: { kind: 'permission-or-access-failure' },
    },
  );
});
