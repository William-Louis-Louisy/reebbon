/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createImageReadingDirectionPreferenceService,
  type ApplicationPreference,
  type ApplicationPreferenceRepository,
} from '../../src/application';
import { err, ok } from '../../src/domain';

function createHarness() {
  const preferences = new Map<string, ApplicationPreference>();
  const writes: string[] = [];
  const repository: ApplicationPreferenceRepository = {
    get(key) {
      return Promise.resolve(ok(preferences.get(key) ?? null));
    },
    save(preference) {
      writes.push(preference.value);
      preferences.set(preference.key, preference);
      return Promise.resolve(ok(undefined));
    },
  };
  const service = createImageReadingDirectionPreferenceService({
    repository,
    now: () => new Date('2026-09-18T10:00:00.000Z'),
  });
  return { preferences, repository, service, writes };
}

test('image direction defaults to left-to-right and is isolated per book', async () => {
  const harness = createHarness();

  assert.deepEqual(await harness.service.load('book-a'), ok('left-to-right'));
  assert.deepEqual(
    await harness.service.save('book-a', 'right-to-left'),
    ok(undefined),
  );
  assert.deepEqual(await harness.service.load('book-a'), ok('right-to-left'));
  assert.deepEqual(await harness.service.load('book-b'), ok('left-to-right'));
});

test('image direction writes are serialized and flush waits for the latest value', async () => {
  const harness = createHarness();

  void harness.service.save('book-a', 'right-to-left');
  void harness.service.save('book-a', 'left-to-right');

  assert.deepEqual(await harness.service.flush(), ok(undefined));
  assert.deepEqual(harness.writes, ['right-to-left', 'left-to-right']);
  assert.deepEqual(await harness.service.load('book-a'), ok('left-to-right'));
});

test('image direction rejects invalid stored values and repository failures', async () => {
  const harness = createHarness();
  harness.preferences.set('reader.images.reading-direction.book-a', {
    key: 'reader.images.reading-direction.book-a',
    value: 'vertical',
    updatedAt: new Date('2026-09-18T10:00:00.000Z'),
  });

  assert.deepEqual(
    await harness.service.load('book-a'),
    err({
      kind: 'invalid-image-reading-direction-preference',
      reason: 'invalid-value',
    }),
  );

  const throwing = createImageReadingDirectionPreferenceService({
    repository: {
      get() {
        throw new Error('database unavailable');
      },
      save() {
        throw new Error('database unavailable');
      },
    },
    now: () => new Date('2026-09-18T10:00:00.000Z'),
  });
  assert.deepEqual(
    await throwing.load('book-a'),
    err({ kind: 'persistence-failure', operation: 'read' }),
  );
  assert.deepEqual(
    await throwing.save('book-a', 'right-to-left'),
    err({ kind: 'persistence-failure', operation: 'write' }),
  );
});
