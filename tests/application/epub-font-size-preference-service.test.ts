/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEpubFontSizePreferenceService,
  type ApplicationPreference,
  type ApplicationPreferenceRepository,
} from '../../src/application';
import {
  defaultReaderFontSize,
  err,
  ok,
  parseReaderFontSize,
} from '../../src/domain';

function fontSize(value: number) {
  const parsed = parseReaderFontSize(value);
  assert.equal(parsed.ok, true);
  return parsed.ok ? parsed.value : defaultReaderFontSize;
}

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

test('EPUB font-size preferences load the default and a persisted value', async () => {
  const empty = createRepository();
  const stored = createRepository({
    key: 'reader.epub.font-size',
    value: '21',
    updatedAt: new Date('2026-09-03T09:00:00.000Z'),
  });

  assert.deepEqual(
    await createEpubFontSizePreferenceService({
      repository: empty.repository,
      now: () => new Date(),
    }).load(),
    ok(defaultReaderFontSize),
  );
  assert.deepEqual(
    await createEpubFontSizePreferenceService({
      repository: stored.repository,
      now: () => new Date(),
    }).load(),
    ok(fontSize(21)),
  );
});

test('EPUB font-size preference writes are serialized in interaction order', async () => {
  const savedValues: string[] = [];
  const resolvers: (() => void)[] = [];
  const repository = createRepository().repository;
  repository.save = (preference) =>
    new Promise((resolve) => {
      savedValues.push(preference.value);
      resolvers.push(() => resolve(ok(undefined)));
    });
  const service = createEpubFontSizePreferenceService({
    repository,
    now: () => new Date('2026-09-03T09:00:00.000Z'),
  });

  const first = service.save(fontSize(18));
  const second = service.save(fontSize(19));
  await Promise.resolve();
  assert.deepEqual(savedValues, ['18']);

  resolvers.shift()?.();
  await first;
  await Promise.resolve();
  assert.deepEqual(savedValues, ['18', '19']);

  resolvers.shift()?.();
  assert.deepEqual(await second, ok(undefined));
  assert.deepEqual(await service.flush(), ok(undefined));
});

test('EPUB font-size preferences type malformed values and repository failures', async () => {
  const malformed = createRepository({
    key: 'reader.epub.font-size',
    value: '48',
    updatedAt: new Date('2026-09-03T09:00:00.000Z'),
  });
  const throwing: ApplicationPreferenceRepository = {
    get: () => Promise.reject(new Error('SQLite read failed')),
    save: () => Promise.reject(new Error('SQLite write failed')),
  };

  assert.deepEqual(
    await createEpubFontSizePreferenceService({
      repository: malformed.repository,
      now: () => new Date(),
    }).load(),
    err({
      kind: 'invalid-epub-font-size-preference',
      reason: 'invalid-value',
    }),
  );
  const service = createEpubFontSizePreferenceService({
    repository: throwing,
    now: () => new Date(),
  });
  assert.deepEqual(await service.load(), err({
    kind: 'persistence-failure',
    operation: 'read',
  }));
  assert.deepEqual(await service.save(fontSize(18)), err({
    kind: 'persistence-failure',
    operation: 'write',
  }));
});
