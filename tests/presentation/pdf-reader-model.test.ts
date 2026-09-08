/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPdfFolio,
  getPdfNavigationGridMetrics,
  parsePdfLocation,
  parsePdfOutline,
  pdfZoomConfiguration,
} from '../../src/presentation/reading/pdf/pdf-reader-model';

test('PDF zoom keeps fit-to-screen as its native minimum scale', () => {
  assert.deepEqual(pdfZoomConfiguration, {
    initialScale: 1,
    minimumScale: 1,
    maximumScale: 3,
    fitPolicy: 2,
    doubleTapEnabled: true,
  });
  assert.equal(
    pdfZoomConfiguration.initialScale,
    pdfZoomConfiguration.minimumScale,
  );
  assert.ok(
    pdfZoomConfiguration.maximumScale > pdfZoomConfiguration.minimumScale,
  );
});

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

test('PDF outline metadata is flattened into validated one-based pages', () => {
  assert.deepEqual(
    parsePdfOutline(
      [
        {
          title: '  Introduction  ',
          pageIdx: 0,
          children: [
            { title: 'Première partie', pageIdx: 4, children: [] },
          ],
        },
        { title: 'Conclusion', pageIdx: 11, children: [] },
      ],
      12,
    ),
    [
      {
        id: 'pdf-outline-0',
        label: 'Introduction',
        page: 1,
        depth: 0,
      },
      {
        id: 'pdf-outline-0.0',
        label: 'Première partie',
        page: 5,
        depth: 1,
      },
      {
        id: 'pdf-outline-1',
        label: 'Conclusion',
        page: 12,
        depth: 0,
      },
    ],
  );
});

test('malformed PDF outline entries never enter navigation', () => {
  assert.deepEqual(
    parsePdfOutline(
      [
        { title: '', pageIdx: 0, children: [] },
        { title: 'Too far', pageIdx: 9, children: [] },
        { title: 'Fraction', pageIdx: 1.5, children: [] },
        { title: 'Wrong type', pageIdx: '1', children: [] },
        { title: 'x'.repeat(241), pageIdx: 1, children: [] },
        null,
      ],
      4,
    ),
    [],
  );
  assert.deepEqual(parsePdfOutline('not-an-outline', 4), []);
  assert.deepEqual(parsePdfOutline([], 0), []);
});

test('PDF page grid adapts from phone to tablet and wide layouts', () => {
  assert.equal(getPdfNavigationGridMetrics(390).columns, 3);
  assert.equal(getPdfNavigationGridMetrics(720).columns, 5);
  const wide = getPdfNavigationGridMetrics(1200);
  assert.equal(wide.columns, 7);
  assert.equal(wide.contentWidth, 1000);
  assert.ok(wide.itemWidth > 0);
  assert.deepEqual(
    getPdfNavigationGridMetrics(Number.NaN),
    getPdfNavigationGridMetrics(320),
  );
});
