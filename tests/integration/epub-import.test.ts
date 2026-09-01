/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createEpubImporter, createListLibraryBooks } from '../../src/application';
import { LocalBookContentStore } from '../../src/infrastructure/filesystem/local-book-content-store';
import type { FileSystemGateway } from '../../src/infrastructure/filesystem/file-system-gateway';
import { migrateDatabase } from '../../src/infrastructure/database/migrations';
import { SqliteBookRepository } from '../../src/infrastructure/database/repositories/sqlite-book-repository';
import { SqliteReadingProgressRepository } from '../../src/infrastructure/database/repositories/sqlite-reading-progress-repository';
import { NodeSqliteConnection } from '../infrastructure/database/node-sqlite-connection';

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
    if (!this.files.has(sourceUri)) {
      throw new Error('Source file does not exist.');
    }
    this.files.add(destinationUri);
    return Promise.resolve();
  }

  public moveDirectory(sourceUri: string, destinationUri: string): Promise<void> {
    if (!this.directories.delete(sourceUri)) {
      throw new Error('Staging directory does not exist.');
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

test('a persisted EPUB appears in the repository-backed library immediately', async () => {
  const connection = new NodeSqliteConnection();
  const fileSystem = new MemoryFileSystemGateway();
  const content = new LocalBookContentStore(fileSystem);
  const sourceUri = 'content://picker/walking-skeleton.epub';
  fileSystem.files.add(sourceUri);

  await migrateDatabase(connection);
  assert.equal((await content.initialize()).ok, true);
  const books = new SqliteBookRepository(connection);
  const readingProgress = new SqliteReadingProgressRepository(connection);
  const identifiers = ['epub-book', 'import-job'];
  const importer = createEpubImporter({
    books,
    content,
    createId() {
      const id = identifiers.shift();
      if (id === undefined) {
        throw new Error('No deterministic identifier available.');
      }
      return id;
    },
    now: () => new Date('2026-09-01T14:00:00.000Z'),
  });

  try {
    const imported = await importer.importBook({
      kind: 'file',
      uri: sourceUri,
      name: 'Walking Skeleton.epub',
      mimeType: 'application/epub+zip',
    });
    const library = await createListLibraryBooks({ books, readingProgress })();

    assert.equal(imported.ok, true);
    assert.equal(library.ok, true);
    assert.deepEqual(library.ok && library.value[0], {
      book: {
        id: 'epub-book',
        title: 'Walking Skeleton',
        format: 'epub',
        fileUri: 'file:///documents/reebbon/books/epub-book/book.epub',
        createdAt: new Date('2026-09-01T14:00:00.000Z'),
      },
      progress: 0,
    });
    assert.equal(
      fileSystem.files.has(
        'file:///documents/reebbon/books/epub-book/book.epub',
      ),
      true,
    );
  } finally {
    await connection.close();
  }
});
