/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCbrImporter,
  createImageDirectoryImportPipeline,
  createImportFormatDetector,
  createListLibraryBooks,
  type CbrArchiveExtractor,
  type ImportDirectoryEntry,
  type ImportFileReader,
} from '../../src/application';
import { err, ok } from '../../src/domain';
import { migrateDatabase } from '../../src/infrastructure/database/migrations';
import { SqliteBookRepository } from '../../src/infrastructure/database/repositories/sqlite-book-repository';
import { SqliteReadingProgressRepository } from '../../src/infrastructure/database/repositories/sqlite-reading-progress-repository';
import { LocalBookContentStore } from '../../src/infrastructure/filesystem/local-book-content-store';
import { NodeSqliteConnection } from '../infrastructure/database/node-sqlite-connection';
import { MemoryFileSystemGateway } from './support/memory-file-system-gateway';

const rar5 = new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('a CBR becomes an Images book through the common pipeline', async () => {
  const connection = new NodeSqliteConnection();
  const fileSystem = new MemoryFileSystemGateway();
  const content = new LocalBookContentStore(fileSystem);
  const sourceUri = 'file:///cache/volume.cbr';
  fileSystem.files.add(sourceUri);
  fileSystem.fileBytes.set(sourceUri, rar5);

  const files = createMemoryFileReader(fileSystem);
  const detector = createImportFormatDetector({ files });
  const archives = new MemoryCbrArchiveExtractor(fileSystem);

  await migrateDatabase(connection);
  assert.equal((await content.initialize()).ok, true);
  const books = new SqliteBookRepository(connection);
  const readingProgress = new SqliteReadingProgressRepository(connection);
  const identifiers = ['image-book', 'image-job'];
  const importer = createCbrImporter({
    archives,
    detector,
    images: createImageDirectoryImportPipeline({
      books,
      content,
      detector,
      directories: createMemoryDirectoryReader(fileSystem),
      files,
      createId() {
        const id = identifiers.shift();
        if (id === undefined) {
          throw new Error('No deterministic identifier available.');
        }
        return id;
      },
      now: () => new Date('2026-09-18T09:00:00.000Z'),
    }),
    createExtractionId: () => 'archive-job',
  });

  try {
    const imported = await importer.importBook({
      kind: 'file',
      uri: sourceUri,
      name: 'Volume 05.cbr',
      mimeType: 'application/vnd.comicbook-rar',
      title: 'Volume CBR',
    });
    const library = await createListLibraryBooks({ books, readingProgress })();

    assert.equal(imported.ok, true);
    assert.deepEqual(library.ok && library.value[0]?.book, {
      id: 'image-book',
      title: 'Volume CBR',
      format: 'images',
      fileUri: 'file:///documents/reebbon/books/image-book',
      coverUri: 'file:///documents/reebbon/books/image-book/page-000001.jpg',
      totalPages: 2,
      createdAt: new Date('2026-09-18T09:00:00.000Z'),
    });
    assert.deepEqual(
      fileSystem.fileBytes.get(
        'file:///documents/reebbon/books/image-book/page-000001.jpg',
      ),
      jpeg,
    );
    assert.deepEqual(
      fileSystem.fileBytes.get(
        'file:///documents/reebbon/books/image-book/page-000002.png',
      ),
      png,
    );
    assert.equal(archives.cleanupCount, 1);
    assert.equal(
      [...fileSystem.files].some((uri) => uri.includes('cbr-archive-job')),
      false,
    );
  } finally {
    await connection.close();
  }
});

class MemoryCbrArchiveExtractor implements CbrArchiveExtractor {
  public cleanupCount = 0;

  public constructor(private readonly fileSystem: MemoryFileSystemGateway) {}

  public async extract(_source: unknown, extractionId: string) {
    const root = `file:///cache/${extractionId}`;
    this.fileSystem.directories.add(root);
    this.fileSystem.files.add(`${root}/page_10.png`);
    this.fileSystem.fileBytes.set(`${root}/page_10.png`, png);
    this.fileSystem.files.add(`${root}/page_2.jpg`);
    this.fileSystem.fileBytes.set(`${root}/page_2.jpg`, jpeg);
    this.fileSystem.files.add(`${root}/notes.txt`);
    this.fileSystem.fileBytes.set(`${root}/notes.txt`, new Uint8Array([1]));
    return ok({
      uri: root,
      entryCount: 3,
      fileCount: 3,
      totalBytes: jpeg.byteLength + png.byteLength + 1,
      solid: true,
    });
  }

  public async cleanup(extractionId: string) {
    this.cleanupCount += 1;
    await this.fileSystem.deleteDirectory(`file:///cache/${extractionId}`);
    return ok(undefined);
  }
}

function createMemoryFileReader(
  fileSystem: MemoryFileSystemGateway,
): ImportFileReader {
  return {
    readPrefix(uri, byteLength) {
      const bytes = fileSystem.fileBytes.get(uri);
      return Promise.resolve(
        bytes === undefined
          ? err({ kind: 'permission-or-access-failure' })
          : ok(bytes.slice(0, byteLength)),
      );
    },
    readAll(uri) {
      const bytes = fileSystem.fileBytes.get(uri);
      return Promise.resolve(
        bytes === undefined
          ? err({ kind: 'permission-or-access-failure' })
          : ok(bytes.slice()),
      );
    },
  };
}

function createMemoryDirectoryReader(fileSystem: MemoryFileSystemGateway) {
  return {
    async list(source: { readonly uri: string }) {
      const prefix = `${source.uri}/`;
      const entries: ImportDirectoryEntry[] = [];
      for (const uri of fileSystem.files) {
        if (!uri.startsWith(prefix)) {
          continue;
        }
        const name = uri.slice(prefix.length);
        if (!name.includes('/')) {
          entries.push({ kind: 'file', uri, name });
        }
      }
      return ok(entries);
    },
  };
}
