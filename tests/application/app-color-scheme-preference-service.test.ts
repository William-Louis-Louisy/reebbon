/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAppColorSchemePreferenceService,
  type ApplicationPreference,
  type ApplicationPreferenceRepository,
} from '../../src/application';
import { err, ok } from '../../src/domain';

function createRepository(
  stored: ApplicationPreference | null = null,
): {
  readonly repository: ApplicationPreferenceRepository;
  readonly writes: ApplicationPreference[];
} {
  const writes: ApplicationPreference[] = [];
  return {
    writes,
    repository: {
      get: () => Promise.resolve(ok(stored)),
      save: (preference) => {
        writes.push(preference);
        return Promise.resolve(ok(undefined));
      },
    },
  };
}

test('application color-scheme preferences default to light and restore a saved choice', async () => {
  const empty = createRepository();
  const stored = createRepository({
    key: 'application.color-scheme',
    value: 'dark',
    updatedAt: new Date('2026-09-03T12:00:00.000Z'),
  });

  assert.deepEqual(
    await createAppColorSchemePreferenceService({
      repository: empty.repository,
      now: () => new Date(),
    }).load(),
    ok('light'),
  );
  assert.deepEqual(
    await createAppColorSchemePreferenceService({
      repository: stored.repository,
      now: () => new Date(),
    }).load(),
    ok('dark'),
  );
});

test('application color-scheme writes are serialized in interaction order', async () => {
  const savedValues: string[] = [];
  const resolvers: (() => void)[] = [];
  const repository = createRepository().repository;
  repository.save = (preference) =>
    new Promise((resolve) => {
      savedValues.push(preference.value);
      resolvers.push(() => resolve(ok(undefined)));
    });
  const service = createAppColorSchemePreferenceService({
    repository,
    now: () => new Date('2026-09-03T12:00:00.000Z'),
  });

  const first = service.save('dark');
  const second = service.save('light');
  await Promise.resolve();
  assert.deepEqual(savedValues, ['dark']);

  resolvers.shift()?.();
  await first;
  await Promise.resolve();
  assert.deepEqual(savedValues, ['dark', 'light']);

  resolvers.shift()?.();
  assert.deepEqual(await second, ok(undefined));
  assert.deepEqual(await service.flush(), ok(undefined));
});

test('application color-scheme preferences type malformed data and repository failures', async () => {
  const malformed = createRepository({
    key: 'application.color-scheme',
    value: 'night',
    updatedAt: new Date('2026-09-03T12:00:00.000Z'),
  });
  const throwing: ApplicationPreferenceRepository = {
    get: () => Promise.reject(new Error('SQLite read failed')),
    save: () => Promise.reject(new Error('SQLite write failed')),
  };

  assert.deepEqual(
    await createAppColorSchemePreferenceService({
      repository: malformed.repository,
      now: () => new Date(),
    }).load(),
    err({
      kind: 'invalid-app-color-scheme-preference',
      reason: 'invalid-value',
    }),
  );
  const service = createAppColorSchemePreferenceService({
    repository: throwing,
    now: () => new Date(),
  });
  assert.deepEqual(
    await service.load(),
    err({ kind: 'persistence-failure', operation: 'read' }),
  );
  assert.deepEqual(
    await service.save('dark'),
    err({ kind: 'persistence-failure', operation: 'write' }),
  );
});
