/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultAppColorScheme,
  isAppColorScheme,
} from '../../src/domain';

test('application color schemes accept only the light and dark UI choices', () => {
  assert.equal(defaultAppColorScheme, 'light');
  assert.equal(isAppColorScheme('light'), true);
  assert.equal(isAppColorScheme('dark'), true);
  assert.equal(isAppColorScheme('paper'), false);
  assert.equal(isAppColorScheme('sepia'), false);
  assert.equal(isAppColorScheme('night'), false);
  assert.equal(isAppColorScheme(null), false);
});
