/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { mapNativeCbzExtractionError } from '../../src/infrastructure/importing/native-cbz-extraction-error';

test('native CBZ errors are mapped by stable codes', () => {
  assert.deepEqual(
    mapNativeCbzExtractionError({ code: 'ERR_CBZ_CORRUPTED_ARCHIVE' }),
    { kind: 'corrupted-archive' },
  );
  assert.deepEqual(
    mapNativeCbzExtractionError({
      code: 'ERR_CBZ_PERMISSION_OR_ACCESS_FAILURE',
    }),
    { kind: 'permission-or-access-failure' },
  );
  assert.deepEqual(
    mapNativeCbzExtractionError({ code: 'ERR_CBZ_FILESYSTEM_FAILURE' }),
    { kind: 'filesystem-failure', operation: 'extract' },
  );
  assert.deepEqual(mapNativeCbzExtractionError(new Error('unknown')), {
    kind: 'filesystem-failure',
    operation: 'extract',
  });
});
