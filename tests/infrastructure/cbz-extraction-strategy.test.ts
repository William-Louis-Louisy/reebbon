/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { selectCbzExtractionStrategy } from '../../src/infrastructure/importing/cbz-extraction-strategy';

test('Android CBZ extraction never falls back to JavaScript', () => {
  assert.equal(selectCbzExtractionStrategy('android', true), 'native');
  assert.equal(selectCbzExtractionStrategy('android', false), 'unavailable');
});

test('non-Android platforms keep the bounded JavaScript fallback', () => {
  assert.equal(selectCbzExtractionStrategy('ios', false), 'javascript');
  assert.equal(selectCbzExtractionStrategy('web', false), 'javascript');
});
