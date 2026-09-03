/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createAppColorSchemePreferenceService } from '../../src/application';
import { ok } from '../../src/domain';
import { migrateDatabase } from '../../src/infrastructure/database/migrations';
import { SqliteApplicationPreferenceRepository } from '../../src/infrastructure/database/repositories/sqlite-application-preference-repository';

import { NodeSqliteConnection } from '../infrastructure/database/node-sqlite-connection';

test('a new application session restores the persisted interface color scheme', async () => {
  const connection = new NodeSqliteConnection();
  await migrateDatabase(connection);
  const repository = new SqliteApplicationPreferenceRepository(connection);

  try {
    const firstSession = createAppColorSchemePreferenceService({
      repository,
      now: () => new Date('2026-09-03T12:00:00.000Z'),
    });
    assert.deepEqual(await firstSession.save('dark'), ok(undefined));
    assert.deepEqual(await firstSession.flush(), ok(undefined));

    const nextSession = createAppColorSchemePreferenceService({
      repository: new SqliteApplicationPreferenceRepository(connection),
      now: () => new Date('2026-09-03T13:00:00.000Z'),
    });
    assert.deepEqual(await nextSession.load(), ok('dark'));
  } finally {
    await connection.close();
  }
});
