/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { mapNativeCbrExtractionError } from '../../src/infrastructure/importing/native-cbr-extraction-error';

test('native CBR errors preserve expected archive rejection categories', () => {
  const cases = [
    ['ERR_CBR_CORRUPTED_ARCHIVE', { kind: 'corrupted-archive' }],
    ['ERR_CBR_ENCRYPTED_ARCHIVE', { kind: 'encrypted-archive' }],
    ['ERR_CBR_MULTIVOLUME_UNSUPPORTED', { kind: 'multi-volume-archive' }],
    ['ERR_CBR_DICTIONARY_LIMIT', { kind: 'limits-exceeded' }],
    ['ERR_CBR_ARCHIVE_SIZE_LIMIT', { kind: 'limits-exceeded' }],
    ['ERR_CBR_ENTRY_COUNT_LIMIT', { kind: 'limits-exceeded' }],
    ['ERR_CBR_UNSAFE_PATH', { kind: 'unsafe-archive' }],
    ['ERR_CBR_LINK_UNSUPPORTED', { kind: 'unsafe-archive' }],
    ['ERR_CBR_SOURCE_ACCESS', { kind: 'permission-or-access-failure' }],
  ] as const;

  for (const [code, expected] of cases) {
    assert.deepEqual(mapNativeCbrExtractionError({ code }, 'extract'), expected);
  }
});

test('unknown extraction and cleanup failures remain typed filesystem errors', () => {
  assert.deepEqual(mapNativeCbrExtractionError(new Error('opaque'), 'extract'), {
    kind: 'filesystem-failure',
    operation: 'extract',
  });
  assert.deepEqual(
    mapNativeCbrExtractionError({ code: 'ERR_CBR_UNSAFE_CLEANUP' }, 'cleanup'),
    {
      kind: 'filesystem-failure',
      operation: 'cleanup',
    },
  );
});
