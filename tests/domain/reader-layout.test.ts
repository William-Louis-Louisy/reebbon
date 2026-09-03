/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultReaderHorizontalMargin,
  defaultReaderLineSpacing,
  isReaderHorizontalMargin,
  isReaderLineSpacing,
  readerHorizontalMarginOptions,
  readerLineSpacingOptions,
} from '../../src/domain';

test('reader layout exposes only the design-system line-spacing choices', () => {
  assert.deepEqual(readerLineSpacingOptions, [1.5, 1.7, 1.9]);
  assert.equal(defaultReaderLineSpacing, 1.7);

  for (const option of readerLineSpacingOptions) {
    assert.equal(isReaderLineSpacing(option), true);
  }
  for (const value of [1.4, 1.6, 2, '1.7', Number.NaN]) {
    assert.equal(isReaderLineSpacing(value), false);
  }
});

test('reader layout exposes compact, comfortable, and generous margins', () => {
  assert.deepEqual(readerHorizontalMarginOptions, [16, 24, 32]);
  assert.equal(defaultReaderHorizontalMargin, 24);

  for (const option of readerHorizontalMarginOptions) {
    assert.equal(isReaderHorizontalMargin(option), true);
  }
  for (const value of [12, 20, 48, '24', Number.NaN]) {
    assert.equal(isReaderHorizontalMargin(value), false);
  }
});
