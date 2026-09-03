/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultReaderFontSize,
  parseReaderFontSize,
  readerFontSizeRange,
  stepReaderFontSize,
} from '../../src/domain';

function fontSize(value: number) {
  const parsed = parseReaderFontSize(value);
  assert.equal(parsed.ok, true);
  return parsed.ok ? parsed.value : defaultReaderFontSize;
}

test('reader font sizes accept the complete design-system range', () => {
  assert.deepEqual(parseReaderFontSize(readerFontSizeRange.minimum), {
    ok: true,
    value: 12,
  });
  assert.equal(defaultReaderFontSize, 17);
  assert.deepEqual(parseReaderFontSize(readerFontSizeRange.maximum), {
    ok: true,
    value: 24,
  });
});

test('reader font sizes reject invalid values and steps stay bounded', () => {
  for (const value of [11, 25, 16.5, Number.NaN, '17']) {
    assert.equal(parseReaderFontSize(value).ok, false);
  }

  assert.equal(
    stepReaderFontSize(
      fontSize(12),
      'decrease',
    ),
    12,
  );
  assert.equal(
    stepReaderFontSize(
      fontSize(24),
      'increase',
    ),
    24,
  );
});
