/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { parseReaderPosition } from '../../src/domain';

test('parseReaderPosition accepts each reader format position', () => {
  const epub = parseReaderPosition({ kind: 'epub', cfi: 'epubcfi(/6/2!/4/1:0)' });
  const pdf = parseReaderPosition({ kind: 'pdf', page: 12 });
  const images = parseReaderPosition({ kind: 'images', index: 0 });

  assert.deepEqual(epub, {
    ok: true,
    value: { kind: 'epub', cfi: 'epubcfi(/6/2!/4/1:0)' },
  });
  assert.deepEqual(pdf, { ok: true, value: { kind: 'pdf', page: 12 } });
  assert.deepEqual(images, { ok: true, value: { kind: 'images', index: 0 } });
});

test('parseReaderPosition rejects malformed persisted positions with typed reasons', () => {
  const cases = [
    [{ cfi: 'missing kind' }, 'missing-kind'],
    [{ kind: 'mobi', offset: 4 }, 'unsupported-kind'],
    [{ kind: 'epub', cfi: '  ' }, 'invalid-epub-cfi'],
    [{ kind: 'pdf', page: 0 }, 'invalid-pdf-page'],
    [{ kind: 'pdf', page: 1.5 }, 'invalid-pdf-page'],
    [{ kind: 'images', index: -1 }, 'invalid-image-index'],
  ] as const;

  for (const [value, expectedReason] of cases) {
    const result = parseReaderPosition(value);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, 'invalid-reader-position');
      assert.equal(result.error.reason, expectedReason);
    }
  }
});
