/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isDirectoryPickerCancellation,
  parsePickedDirectory,
} from '../../src/infrastructure/importing/directory-import-source-picker-core';

test('directory picker maps a native directory into an import source', () => {
  assert.deepEqual(
    parsePickedDirectory({
      uri: 'content://tree/primary%3APictures%2FComic',
      name: 'Comic',
    }),
    {
      ok: true,
      value: {
        kind: 'directory',
        uri: 'content://tree/primary%3APictures%2FComic',
        name: 'Comic',
      },
    },
  );
});

test('directory picker treats Android and iOS cancellation as expected', async (t) => {
  for (const code of ['ERR_PICKER_CANCELLED', 'ERR_FILE_PICKING_CANCELLED']) {
    await t.test(code, () => {
      assert.equal(isDirectoryPickerCancellation({ code }), true);
    });
  }
});

test('directory picker rejects malformed native selections', () => {
  assert.deepEqual(parsePickedDirectory({ uri: '', name: '' }), {
    ok: false,
    error: { kind: 'permission-or-access-failure' },
  });
  assert.equal(isDirectoryPickerCancellation(new Error('native failure')), false);
});
