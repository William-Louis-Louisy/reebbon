/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { strToU8, zipSync } from 'fflate';

import {
  createEpubImporter,
  createImportFormatDetector,
  type BookRepository,
  type ImportFileReader,
  type ImportSourceFor,
} from '../../src/application';
import { err, ok } from '../../src/domain';
import { migrateDatabase } from '../../src/infrastructure/database/migrations';
import { SqliteBookRepository } from '../../src/infrastructure/database/repositories/sqlite-book-repository';
import { LocalBookContentStore } from '../../src/infrastructure/filesystem/local-book-content-store';
import { EpubMetadataExtractor } from '../../src/infrastructure/importing/epub-metadata-extractor';
import { NodeSqliteConnection } from '../infrastructure/database/node-sqlite-connection';
import { MemoryFileSystemGateway } from './support/memory-file-system-gateway';

const booksRootUri = 'file:///documents/reebbon/books';
const stagingRootUri = 'file:///cache/reebbon/import-staging';

function validEpubArchive(): Uint8Array {
  const coverBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  return zipSync({
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8(
      '<container><rootfiles><rootfile full-path="OPS/package.opf" /></rootfiles></container>',
    ),
    'OPS/package.opf': strToU8(
      '<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Atomic EPUB</dc:title></metadata><manifest><item id="cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image" /></manifest></package>',
    ),
    'OPS/cover.jpg': coverBytes,
  });
}

function addSource(
  fileSystem: MemoryFileSystemGateway,
  name: string,
  bytes: Uint8Array,
): ImportSourceFor<'epub'> {
  const uri = `content://picker/${name}`;
  fileSystem.files.add(uri);
  fileSystem.fileBytes.set(uri, bytes);
  return { kind: 'file', uri, name };
}

function createReader(fileSystem: MemoryFileSystemGateway): ImportFileReader {
  const read = (uri: string) => {
    const bytes = fileSystem.fileBytes.get(uri);
    return bytes === undefined
      ? err({ kind: 'permission-or-access-failure' } as const)
      : ok(bytes.slice());
  };

  return {
    async readPrefix(uri, byteLength) {
      const result = read(uri);
      return result.ok ? ok(result.value.slice(0, byteLength)) : result;
    },
    readAll(uri) {
      return Promise.resolve(read(uri));
    },
  };
}

function assertNoImportedResources(fileSystem: MemoryFileSystemGateway): void {
  assert.deepEqual(fileSystem.directories, new Set([booksRootUri, stagingRootUri]));
  assert.equal(
    [...fileSystem.files].some(
      (uri) => uri.startsWith(`${booksRootUri}/`) || uri.startsWith(`${stagingRootUri}/`),
    ),
    false,
  );
}

async function createHarness(
  createBooks?: (
    books: SqliteBookRepository,
  ) => Pick<BookRepository, 'save' | 'delete'>,
) {
  const connection = new NodeSqliteConnection();
  await migrateDatabase(connection);
  const fileSystem = new MemoryFileSystemGateway();
  const content = new LocalBookContentStore(fileSystem);
  assert.equal((await content.initialize()).ok, true);
  const books = new SqliteBookRepository(connection);
  const files = createReader(fileSystem);
  const identifiers = ['book-1', 'job-1'];
  const importer = createEpubImporter({
    books: createBooks?.(books) ?? books,
    content,
    detector: createImportFormatDetector({ files }),
    metadata: new EpubMetadataExtractor(files),
    createId() {
      const id = identifiers.shift();
      if (id === undefined) {
        throw new Error('No deterministic identifier available.');
      }
      return id;
    },
    now: () => new Date('2026-09-02T12:00:00.000Z'),
  });

  return { books, connection, fileSystem, importer };
}

test('unsupported and corrupted files fail without creating database or file resources', async (context) => {
  for (const candidate of [
    {
      name: 'book.mobi',
      bytes: strToU8('MOBI'),
      expectedErrorKind: 'unsupported-format',
    },
    {
      name: 'book.epub',
      bytes: strToU8('not a zip archive'),
      expectedErrorKind: 'corrupted-source',
    },
  ]) {
    await context.test(candidate.name, async () => {
      const harness = await createHarness();
      try {
        const source = addSource(harness.fileSystem, candidate.name, candidate.bytes);
        const result = await harness.importer.importBook(source);
        const persisted = await harness.books.list();

        assert.equal(result.ok, false);
        assert.equal(!result.ok && result.error.kind, candidate.expectedErrorKind);
        assert.deepEqual(persisted, ok([]));
        assertNoImportedResources(harness.fileSystem);
      } finally {
        await harness.connection.close();
      }
    });
  }
});

test('a truncated EPUB archive leaves no staging or persisted book', async () => {
  const harness = await createHarness();
  try {
    const source = addSource(
      harness.fileSystem,
      'broken.epub',
      new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]),
    );
    const result = await harness.importer.importBook(source);

    assert.deepEqual(result, {
      ok: false,
      error: { kind: 'corrupted-source', format: 'epub' },
    });
    assert.deepEqual(await harness.books.list(), ok([]));
    assertNoImportedResources(harness.fileSystem);
  } finally {
    await harness.connection.close();
  }
});

test('a partial database save is rolled back with all committed files', async () => {
  const harness = await createHarness((books) => ({
    async save(book) {
      const saved = await books.save(book);
      return saved.ok
        ? err({ kind: 'persistence-failure', operation: 'write' })
        : saved;
    },
    delete: (bookId) => books.delete(bookId),
  }));
  try {
    const source = addSource(harness.fileSystem, 'atomic.epub', validEpubArchive());
    const result = await harness.importer.importBook(source);

    assert.deepEqual(result, {
      ok: false,
      error: { kind: 'persistence-failure', operation: 'save' },
    });
    assert.deepEqual(await harness.books.list(), ok([]));
    assertNoImportedResources(harness.fileSystem);
  } finally {
    await harness.connection.close();
  }
});
