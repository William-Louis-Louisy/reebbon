/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { strToU8, zipSync } from 'fflate';

import {
  createCbzImporter,
  createImageDirectoryImportPipeline,
  createImportFormatDetector,
  createListLibraryBooks,
  type CbzArchiveExtractor,
  type ImportDirectoryEntry,
  type ImportFileReader,
} from '../../src/application';
import { err, ok } from '../../src/domain';
import { migrateDatabase } from '../../src/infrastructure/database/migrations';
import { SqliteBookRepository } from '../../src/infrastructure/database/repositories/sqlite-book-repository';
import { SqliteReadingProgressRepository } from '../../src/infrastructure/database/repositories/sqlite-reading-progress-repository';
import { LocalBookContentStore } from '../../src/infrastructure/filesystem/local-book-content-store';
import {
  extractCbzChunks,
  type CbzExtractionTarget,
} from '../../src/infrastructure/importing/cbz-stream-extractor-core';
import { NodeSqliteConnection } from '../infrastructure/database/node-sqlite-connection';
import { MemoryFileSystemGateway } from './support/memory-file-system-gateway';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('a CBZ reuses the image pipeline and appears in the library', async () => {
  const connection = new NodeSqliteConnection();
  const fileSystem = new MemoryFileSystemGateway();
  const content = new LocalBookContentStore(fileSystem);
  const sourceUri = 'file:///cache/volume.cbz';
  const archive = zipSync({
    'page_10.jpg': jpeg,
    'page_2.png': png,
    'page_001.jpg': jpeg,
    'notes.txt': strToU8('ignored'),
  });
  fileSystem.files.add(sourceUri);
  fileSystem.fileBytes.set(sourceUri, archive);

  const files = createMemoryFileReader(fileSystem);
  const detector = createImportFormatDetector({ files });
  const directories = createMemoryDirectoryReader(fileSystem);
  const archives = new MemoryCbzArchiveExtractor(fileSystem, archive);

  await migrateDatabase(connection);
  assert.equal((await content.initialize()).ok, true);
  const books = new SqliteBookRepository(connection);
  const readingProgress = new SqliteReadingProgressRepository(connection);
  const identifiers = ['image-book', 'image-job'];
  const images = createImageDirectoryImportPipeline({
    books,
    content,
    detector,
    directories,
    files,
    createId() {
      const id = identifiers.shift();
      if (id === undefined) {
        throw new Error('No deterministic identifier available.');
      }
      return id;
    },
    now: () => new Date('2026-09-10T09:00:00.000Z'),
  });
  const importer = createCbzImporter({
    archives,
    detector,
    images,
    createExtractionId: () => 'archive-job',
  });

  try {
    const imported = await importer.importBook({
      kind: 'file',
      uri: sourceUri,
      name: 'Volume 01.cbz',
      mimeType: 'application/vnd.comicbook+zip',
      title: 'Volume pilote',
    });
    const library = await createListLibraryBooks({ books, readingProgress })();

    assert.equal(imported.ok, true);
    assert.deepEqual(library.ok && library.value[0], {
      book: {
        id: 'image-book',
        title: 'Volume pilote',
        format: 'images',
        fileUri: 'file:///documents/reebbon/books/image-book',
        coverUri:
          'file:///documents/reebbon/books/image-book/page-000001.jpg',
        totalPages: 3,
        createdAt: new Date('2026-09-10T09:00:00.000Z'),
      },
      progress: 0,
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
    assert.equal(
      [...fileSystem.files].some((uri) => uri.includes('cbz-archive-job')),
      false,
    );
    assert.equal(archives.cleanupCount, 1);
  } finally {
    await connection.close();
  }
});

test('a truncated CBZ leaves no database, staging or extraction resources', async () => {
  const connection = new NodeSqliteConnection();
  const fileSystem = new MemoryFileSystemGateway();
  const content = new LocalBookContentStore(fileSystem);
  const complete = zipSync({ '001.jpg': jpeg });
  const archive = complete.slice(0, complete.byteLength - 8);
  const sourceUri = 'file:///cache/corrupt.cbz';
  fileSystem.files.add(sourceUri);
  fileSystem.fileBytes.set(sourceUri, archive);
  const files = createMemoryFileReader(fileSystem);
  const detector = createImportFormatDetector({ files });
  const archives = new MemoryCbzArchiveExtractor(fileSystem, archive);

  await migrateDatabase(connection);
  assert.equal((await content.initialize()).ok, true);
  const books = new SqliteBookRepository(connection);
  const readingProgress = new SqliteReadingProgressRepository(connection);
  const importer = createCbzImporter({
    archives,
    detector,
    images: createImageDirectoryImportPipeline({
      books,
      content,
      detector,
      directories: createMemoryDirectoryReader(fileSystem),
      files,
      createId: () => 'unused',
      now: () => new Date(),
    }),
    createExtractionId: () => 'archive-job',
  });

  try {
    assert.deepEqual(
      await importer.importBook({
        kind: 'file',
        uri: sourceUri,
        name: 'corrupt.cbz',
      }),
      { ok: false, error: { kind: 'corrupted-source', format: 'cbz' } },
    );
    assert.deepEqual(await books.list(), { ok: true, value: [] });
    assert.equal(
      [...fileSystem.directories].some((uri) => uri.includes('archive-job')),
      false,
    );
    assert.equal(
      [...fileSystem.files].some((uri) => uri.includes('archive-job')),
      false,
    );
  } finally {
    await connection.close();
  }
});

class MemoryCbzArchiveExtractor implements CbzArchiveExtractor {
  public cleanupCount = 0;

  public constructor(
    private readonly fileSystem: MemoryFileSystemGateway,
    private readonly archive: Uint8Array,
  ) {}

  public async extract(_source: unknown, extractionId: string) {
    const rootUri = `file:///cache/cbz-${extractionId}`;
    this.fileSystem.directories.add(rootUri);
    const target: CbzExtractionTarget = {
      createDirectory: (relativePath) => {
        this.fileSystem.directories.add(`${rootUri}/${relativePath}`);
      },
      createFile: (relativePath) => {
        const uri = `${rootUri}/${relativePath}`;
        const bytes: number[] = [];
        this.fileSystem.files.add(uri);
        return {
          write: (chunk) => bytes.push(...chunk),
          close: () => this.fileSystem.fileBytes.set(uri, Uint8Array.from(bytes)),
        };
      },
    };
    const extracted = extractCbzChunks([this.archive], target);
    return extracted.ok
      ? ok({ uri: rootUri })
      : err(
          extracted.error.kind === 'invalid-archive'
            ? { kind: 'corrupted-archive' as const }
            : {
                kind: 'filesystem-failure' as const,
                operation: 'extract' as const,
              },
        );
  }

  public async cleanup(extractionId: string) {
    this.cleanupCount += 1;
    await this.fileSystem.deleteDirectory(`file:///cache/cbz-${extractionId}`);
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
