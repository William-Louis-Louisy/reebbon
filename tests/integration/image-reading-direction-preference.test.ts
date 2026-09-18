/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createImageReadingDirectionPreferenceService } from '../../src/application';
import { ok } from '../../src/domain';
import { migrateDatabase } from '../../src/infrastructure/database/migrations';
import { SqliteApplicationPreferenceRepository } from '../../src/infrastructure/database/repositories/sqlite-application-preference-repository';

import { NodeSqliteConnection } from '../infrastructure/database/node-sqlite-connection';

test('a reopened image reading session restores its per-book direction', async () => {
  const connection = new NodeSqliteConnection();
  await migrateDatabase(connection);
  const repository = new SqliteApplicationPreferenceRepository(connection);

  try {
    const firstSession = createImageReadingDirectionPreferenceService({
      repository,
      now: () => new Date('2026-09-18T10:00:00.000Z'),
    });
    assert.deepEqual(
      await firstSession.save('manga-book', 'right-to-left'),
      ok(undefined),
    );
    assert.deepEqual(await firstSession.flush(), ok(undefined));

    const reopenedSession = createImageReadingDirectionPreferenceService({
      repository: new SqliteApplicationPreferenceRepository(connection),
      now: () => new Date('2026-09-18T11:00:00.000Z'),
    });
    assert.deepEqual(
      await reopenedSession.load('manga-book'),
      ok('right-to-left'),
    );
    assert.deepEqual(
      await reopenedSession.load('western-comic-book'),
      ok('left-to-right'),
    );
  } finally {
    await connection.close();
  }
});
