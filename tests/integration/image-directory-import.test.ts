/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createImageDirectoryImporter,
  createImportFormatDetector,
  createListLibraryBooks,
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

const pageCount = 205;
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 1]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 2]);

test('a 200+ page image directory is ordered, copied and listed without full reads', async () => {
  const connection = new NodeSqliteConnection();
  const fileSystem = new MemoryFileSystemGateway();
  const content = new LocalBookContentStore(fileSystem);
  const entries: ImportDirectoryEntry[] = [];

  for (let page = pageCount; page >= 1; page -= 1) {
    const extension = page % 2 === 0 ? 'png' : 'jpg';
    const uri = `content://comic/page_${page}.${extension}`;
    const bytes = extension === 'png' ? png : jpeg;
    entries.push({ kind: 'file', uri, name: `page_${page}.${extension}` });
    fileSystem.files.add(uri);
    fileSystem.fileBytes.set(uri, bytes);
  }
  entries.push({
    kind: 'file',
    uri: 'content://comic/credits.txt',
    name: 'credits.txt',
  });
  entries.push({
    kind: 'directory',
    uri: 'content://comic/extras',
    name: 'extras',
  });

  let prefixReads = 0;
  let fullReads = 0;
  const files: ImportFileReader = {
    readPrefix(uri, byteLength) {
      prefixReads += 1;
      const bytes = fileSystem.fileBytes.get(uri);
      return Promise.resolve(
        bytes === undefined
          ? err({ kind: 'permission-or-access-failure' })
          : ok(bytes.slice(0, byteLength)),
      );
    },
    readAll() {
      fullReads += 1;
      return Promise.resolve(err({ kind: 'permission-or-access-failure' }));
    },
  };

  await migrateDatabase(connection);
  assert.equal((await content.initialize()).ok, true);
  const books = new SqliteBookRepository(connection);
  const readingProgress = new SqliteReadingProgressRepository(connection);
  const identifiers = ['image-book', 'image-job'];
  const importer = createImageDirectoryImporter({
    books,
    content,
    detector: createImportFormatDetector({ files }),
    directories: { list: async () => ok(entries) },
    files,
    createId() {
      const id = identifiers.shift();
      if (id === undefined) {
        throw new Error('No deterministic identifier available.');
      }
      return id;
    },
    now: () => new Date('2026-09-09T14:00:00.000Z'),
  });

  try {
    const imported = await importer.importBook({
      kind: 'directory',
      uri: 'content://comic',
      name: 'Le grand album',
    });
    const library = await createListLibraryBooks({ books, readingProgress })();

    assert.equal(imported.ok, true);
    assert.deepEqual(library.ok && library.value[0], {
      book: {
        id: 'image-book',
        title: 'Le grand album',
        format: 'images',
        fileUri: 'file:///documents/reebbon/books/image-book',
        coverUri:
          'file:///documents/reebbon/books/image-book/page-000001.jpg',
        totalPages: pageCount,
        createdAt: new Date('2026-09-09T14:00:00.000Z'),
      },
      progress: 0,
    });
    assert.equal(prefixReads, pageCount);
    assert.equal(fullReads, 0);
    assert.equal(
      fileSystem.files.has(
        'file:///documents/reebbon/books/image-book/page-000001.jpg',
      ),
      true,
    );
    assert.equal(
      fileSystem.files.has(
        'file:///documents/reebbon/books/image-book/page-000205.jpg',
      ),
      true,
    );
    assert.deepEqual(
      fileSystem.fileBytes.get(
        'file:///documents/reebbon/books/image-book/page-000001.jpg',
      ),
      jpeg,
    );
  } finally {
    await connection.close();
  }
});
