/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { getRibbonHeight, normalizeProgress } from '../../src/presentation/components/ribbon-metrics';
import { getLibraryGridMetrics } from '../../src/presentation/screens/library/library-layout';
import { designSystemTokens } from '../../src/shared/theme';

test('library grid adapts from phone to tablet and wide layouts', () => {
  const phone = getLibraryGridMetrics(390);
  const tablet = getLibraryGridMetrics(768);
  const wide = getLibraryGridMetrics(1200);

  assert.equal(phone.columns, 2);
  assert.equal(tablet.columns, 3);
  assert.equal(wide.columns, 4);
  assert.equal(wide.contentWidth, designSystemTokens.layout.maxContentWidth);
  assert.ok(phone.itemWidth > 0);
  assert.ok(tablet.itemWidth > phone.itemWidth);
});

test('ribbon progression is clamped and controls its visible length', () => {
  const ribbon = designSystemTokens.components.ribbon;

  assert.equal(normalizeProgress(Number.NaN), 0);
  assert.equal(normalizeProgress(-1), 0);
  assert.equal(normalizeProgress(2), 1);
  assert.equal(getRibbonHeight(0), ribbon.minHeight);
  assert.equal(getRibbonHeight(1), ribbon.maxHeight);
  assert.equal(
    getRibbonHeight(0.5),
    ribbon.minHeight + (ribbon.maxHeight - ribbon.minHeight) / 2,
  );
});
