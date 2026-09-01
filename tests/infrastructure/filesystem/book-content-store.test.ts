/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { FileSystemGateway } from '../../../src/infrastructure/filesystem/file-system-gateway';
import { LocalBookContentStore } from '../../../src/infrastructure/filesystem/local-book-content-store';

class MemoryFileSystemGateway implements FileSystemGateway {
  public readonly documentDirectoryUri = 'file:///documents';
  public readonly cacheDirectoryUri = 'file:///cache';
  public readonly directories = new Set<string>();
  public readonly files = new Set<string>();

  public createDirectory(uri: string, idempotent: boolean): Promise<void> {
    if (this.directories.has(uri) && !idempotent) {
      throw new Error('Directory already exists.');
    }
    this.directories.add(uri);
    return Promise.resolve();
  }

  public directoryExists(uri: string): boolean {
    return this.directories.has(uri);
  }

  public fileExists(uri: string): boolean {
    return this.files.has(uri);
  }

  public copyFile(sourceUri: string, destinationUri: string): Promise<void> {
    if (!this.files.has(sourceUri) || this.files.has(destinationUri)) {
      throw new Error('Copy failed.');
    }
    this.files.add(destinationUri);
    return Promise.resolve();
  }

  public moveDirectory(sourceUri: string, destinationUri: string): Promise<void> {
    if (!this.directories.delete(sourceUri) || this.directories.has(destinationUri)) {
      throw new Error('Move failed.');
    }
    this.directories.add(destinationUri);

    for (const file of [...this.files]) {
      if (file.startsWith(`${sourceUri}/`)) {
        this.files.delete(file);
        this.files.add(`${destinationUri}${file.slice(sourceUri.length)}`);
      }
    }
    return Promise.resolve();
  }

  public deleteDirectory(uri: string): Promise<void> {
    this.directories.delete(uri);
    for (const file of [...this.files]) {
      if (file.startsWith(`${uri}/`)) {
        this.files.delete(file);
      }
    }
    return Promise.resolve();
  }
}

test('book content moves from cache staging to persistent documents and can be removed', async () => {
  const fileSystem = new MemoryFileSystemGateway();
  const store = new LocalBookContentStore(fileSystem);
  const sourceUri = 'content://picker/book.epub';
  fileSystem.files.add(sourceUri);

  assert.equal((await store.initialize()).ok, true);
  const staging = await store.createStagingArea('import-1');
  const stagedFile = await store.stageFile('import-1', sourceUri, 'book.epub');
  const committed = await store.commitStagingArea('import-1', 'book-1');

  assert.deepEqual(staging, {
    ok: true,
    value: {
      id: 'import-1',
      uri: 'file:///cache/reebbon/import-staging/import-1',
    },
  });
  assert.deepEqual(stagedFile, {
    ok: true,
    value: 'file:///cache/reebbon/import-staging/import-1/book.epub',
  });
  assert.deepEqual(committed, {
    ok: true,
    value: {
      bookId: 'book-1',
      uri: 'file:///documents/reebbon/books/book-1',
    },
  });
  assert.equal(
    fileSystem.files.has('file:///documents/reebbon/books/book-1/book.epub'),
    true,
  );
  assert.equal(fileSystem.directories.has('file:///cache/reebbon/import-staging/import-1'), false);

  assert.equal((await store.removeBookFiles('book-1')).ok, true);
  assert.equal((await store.removeBookFiles('book-1')).ok, true);
  assert.equal(
    fileSystem.files.has('file:///documents/reebbon/books/book-1/book.epub'),
    false,
  );
});

test('book content store rejects unsafe segments and inaccessible sources', async () => {
  const fileSystem = new MemoryFileSystemGateway();
  const store = new LocalBookContentStore(fileSystem);
  await store.initialize();

  assert.deepEqual(await store.createStagingArea('../escape'), {
    ok: false,
    error: { kind: 'invalid-storage-path', operation: 'create-staging-area' },
  });

  await store.createStagingArea('import-2');
  assert.deepEqual(
    await store.stageFile('import-2', 'content://missing.epub', 'book.epub'),
    {
      ok: false,
      error: { kind: 'permission-or-access-failure', operation: 'stage-file' },
    },
  );
  assert.deepEqual(await store.removeBookFiles('book/escape'), {
    ok: false,
    error: { kind: 'invalid-storage-path', operation: 'remove-book-files' },
  });
});

test('native permission codes are mapped without inspecting error messages', async () => {
  const fileSystem = new MemoryFileSystemGateway();
  fileSystem.createDirectory = () =>
    Promise.reject(Object.assign(new Error('opaque native error'), { code: 'EACCES' }));
  const store = new LocalBookContentStore(fileSystem);

  assert.deepEqual(await store.initialize(), {
    ok: false,
    error: { kind: 'permission-or-access-failure', operation: 'initialize' },
  });
});
