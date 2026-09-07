/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPdfFolio,
  parsePdfLocation,
} from '../../src/presentation/reading/pdf/pdf-reader-model';

test('PDF native locations are validated as one-based pages', () => {
  assert.deepEqual(parsePdfLocation(3, 12), {
    ok: true,
    value: { page: 3, totalPages: 12 },
  });
  for (const [page, totalPages] of [
    [0, 12],
    [13, 12],
    [1.5, 12],
    [1, 0],
    [Number.NaN, 12],
    ['1', 12],
  ] as const) {
    assert.deepEqual(parsePdfLocation(page, totalPages), {
      ok: false,
      error: { kind: 'invalid-pdf-location' },
    });
  }
});

test('PDF folio reflects the validated native page', () => {
  assert.deepEqual(getPdfFolio({ page: 7, totalPages: 20 }), {
    current: 7,
    total: 20,
  });
  assert.equal(getPdfFolio(undefined), undefined);
});
