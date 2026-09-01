/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  BookContentStore,
  FileStorageError,
} from '../../src/application';
import { err, ok, type Result } from '../../src/domain';
import { initializeLocalStorageWithDependencies } from '../../src/infrastructure/local-storage-core';

import { NodeSqliteConnection } from './database/node-sqlite-connection';

class TestContentStore implements BookContentStore {
  public constructor(
    private readonly initialization: Result<void, FileStorageError> = ok(undefined),
  ) {}

  public initialize(): Promise<Result<void, FileStorageError>> {
    return Promise.resolve(this.initialization);
  }

  public createStagingArea(): never {
    throw new Error('Not used by this test.');
  }

  public stageFile(): never {
    throw new Error('Not used by this test.');
  }

  public commitStagingArea(): never {
    throw new Error('Not used by this test.');
  }

  public removeStagingArea(): never {
    throw new Error('Not used by this test.');
  }

  public removeBookFiles(): never {
    throw new Error('Not used by this test.');
  }
}

test('local storage initialization migrates SQLite and exposes every required port', async () => {
  const connection = new NodeSqliteConnection();
  const initialized = await initializeLocalStorageWithDependencies({
    openDatabase: () => Promise.resolve(connection),
    contentStore: new TestContentStore(),
  });

  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal((await initialized.value.books.list()).ok, true);
    assert.equal(
      (await initialized.value.readingProgress.getByBookId('missing')).ok,
      true,
    );
    assert.equal((await initialized.value.bookmarks.listByBookId('missing')).ok, true);
    assert.ok(initialized.value.content instanceof TestContentStore);
    await initialized.value.close();
  }
});

test('local storage initialization closes SQLite when FileSystem setup fails', async () => {
  const connection = new NodeSqliteConnection();
  let closed = false;
  const close = connection.close.bind(connection);
  connection.close = async () => {
    closed = true;
    await close();
  };

  const initialized = await initializeLocalStorageWithDependencies({
    openDatabase: () => Promise.resolve(connection),
    contentStore: new TestContentStore(
      err({ kind: 'filesystem-failure', operation: 'initialize' }),
    ),
  });

  assert.deepEqual(initialized, {
    ok: false,
    error: { kind: 'filesystem-failure', operation: 'initialize' },
  });
  assert.equal(closed, true);
});

test('local storage initialization types unexpected FileSystem failures', async () => {
  const connection = new NodeSqliteConnection();
  let closed = false;
  const close = connection.close.bind(connection);
  connection.close = async () => {
    closed = true;
    await close();
  };

  const contentStore = new TestContentStore();
  contentStore.initialize = () => Promise.reject(new Error('Native failure'));

  const initialized = await initializeLocalStorageWithDependencies({
    openDatabase: () => Promise.resolve(connection),
    contentStore,
  });

  assert.deepEqual(initialized, {
    ok: false,
    error: { kind: 'filesystem-failure', operation: 'initialize' },
  });
  assert.equal(closed, true);
});
