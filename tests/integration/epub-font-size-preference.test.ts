/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createEpubFontSizePreferenceService } from '../../src/application';
import {
  defaultReaderFontSize,
  ok,
  parseReaderFontSize,
} from '../../src/domain';
import { migrateDatabase } from '../../src/infrastructure/database/migrations';
import { SqliteApplicationPreferenceRepository } from '../../src/infrastructure/database/repositories/sqlite-application-preference-repository';

import { NodeSqliteConnection } from '../infrastructure/database/node-sqlite-connection';

test('a new EPUB reading session restores the persisted font size', async () => {
  const connection = new NodeSqliteConnection();
  await migrateDatabase(connection);
  const repository = new SqliteApplicationPreferenceRepository(connection);
  const selected = parseReaderFontSize(22);
  assert.equal(selected.ok, true);
  if (!selected.ok) {
    await connection.close();
    return;
  }

  try {
    const firstSession = createEpubFontSizePreferenceService({
      repository,
      now: () => new Date('2026-09-03T10:00:00.000Z'),
    });
    assert.deepEqual(await firstSession.save(selected.value), ok(undefined));
    assert.deepEqual(await firstSession.flush(), ok(undefined));

    const nextSession = createEpubFontSizePreferenceService({
      repository: new SqliteApplicationPreferenceRepository(connection),
      now: () => new Date('2026-09-03T11:00:00.000Z'),
    });
    assert.deepEqual(await nextSession.load(), ok(selected.value));
    assert.notEqual(selected.value, defaultReaderFontSize);
  } finally {
    await connection.close();
  }
});
