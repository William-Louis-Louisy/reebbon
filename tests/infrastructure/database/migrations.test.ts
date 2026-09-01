/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  latestDatabaseVersion,
  migrateDatabase,
  UnsupportedDatabaseVersionError,
} from '../../../src/infrastructure/database/migrations';

import { NodeSqliteConnection } from './node-sqlite-connection';

test('migrateDatabase creates the complete non-binary schema and is idempotent', async () => {
  const connection = new NodeSqliteConnection();

  try {
    await migrateDatabase(connection);
    await migrateDatabase(connection);

    const version = await connection.getFirst<{ user_version: number }>(
      'PRAGMA user_version',
    );
    const foreignKeys = await connection.getFirst<{ foreign_keys: number }>(
      'PRAGMA foreign_keys',
    );
    const tables = await connection.getAll<{ name: string; sql: string }>(
      `
        SELECT name, sql
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `,
    );

    assert.equal(version?.user_version, latestDatabaseVersion);
    assert.equal(foreignKeys?.foreign_keys, 1);
    assert.deepEqual(
      tables.map((table) => table.name),
      ['application_preferences', 'bookmarks', 'books', 'reading_progress'],
    );
    assert.equal(tables.some((table) => /\bBLOB\b/i.test(table.sql)), false);
  } finally {
    await connection.close();
  }
});

test('migrateDatabase refuses to downgrade a database from a future version', async () => {
  const connection = new NodeSqliteConnection();

  try {
    await connection.exec('PRAGMA user_version = 99');
    await assert.rejects(
      migrateDatabase(connection),
      (error: unknown) =>
        error instanceof UnsupportedDatabaseVersionError && error.version === 99,
    );
  } finally {
    await connection.close();
  }
});
