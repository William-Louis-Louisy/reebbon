/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createImportFormatDetector,
  createListLibraryBooks,
  createPdfImporter,
  type ImportFileReader,
} from '../../src/application';
import { err, ok } from '../../src/domain';
import { migrateDatabase } from '../../src/infrastructure/database/migrations';
import { SqliteBookRepository } from '../../src/infrastructure/database/repositories/sqlite-book-repository';
import { SqliteReadingProgressRepository } from '../../src/infrastructure/database/repositories/sqlite-reading-progress-repository';
import { LocalBookContentStore } from '../../src/infrastructure/filesystem/local-book-content-store';
import type { PdfFirstPageRenderer } from '../../src/infrastructure/importing/pdf-first-page-renderer';
import { PdfMetadataExtractor } from '../../src/infrastructure/importing/pdf-metadata-extractor';
import { NodeSqliteConnection } from '../infrastructure/database/node-sqlite-connection';
import { MemoryFileSystemGateway } from './support/memory-file-system-gateway';

test('a persisted PDF and generated cover appear in the library immediately', async () => {
  const connection = new NodeSqliteConnection();
  const fileSystem = new MemoryFileSystemGateway();
  const content = new LocalBookContentStore(fileSystem);
  const sourceUri = 'content://picker/offline-catalogue.pdf';
  const coverBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xd9]);
  const pdfBytes = new TextEncoder().encode('%PDF-1.7\n% bounded fixture');
  let fullSourceReads = 0;
  fileSystem.files.add(sourceUri);
  fileSystem.fileBytes.set(sourceUri, pdfBytes);

  await migrateDatabase(connection);
  assert.equal((await content.initialize()).ok, true);
  const books = new SqliteBookRepository(connection);
  const readingProgress = new SqliteReadingProgressRepository(connection);
  const files: ImportFileReader = {
    readPrefix(uri, byteLength) {
      const bytes = fileSystem.fileBytes.get(uri);
      return Promise.resolve(
        bytes === undefined
          ? err({ kind: 'permission-or-access-failure' })
          : ok(bytes.slice(0, byteLength)),
      );
    },
    readAll(uri) {
      fullSourceReads += 1;
      const bytes = fileSystem.fileBytes.get(uri);
      return Promise.resolve(
        bytes === undefined
          ? err({ kind: 'permission-or-access-failure' })
          : ok(bytes.slice()),
      );
    },
  };
  const firstPage: PdfFirstPageRenderer = {
    render: async () =>
      ok({
        cover: { bytes: coverBytes, mediaType: 'image/jpeg' },
        totalPages: 2,
      }),
  };
  const identifiers = ['pdf-book', 'import-job'];
  const importer = createPdfImporter({
    books,
    content,
    detector: createImportFormatDetector({ files }),
    metadata: new PdfMetadataExtractor(firstPage),
    createId() {
      const id = identifiers.shift();
      if (id === undefined) {
        throw new Error('No deterministic identifier available.');
      }
      return id;
    },
    now: () => new Date('2026-09-07T10:00:00.000Z'),
  });

  try {
    const imported = await importer.importBook({
      kind: 'file',
      uri: sourceUri,
      name: 'Offline Catalogue.pdf',
      mimeType: 'application/pdf',
    });
    const library = await createListLibraryBooks({ books, readingProgress })();

    assert.equal(imported.ok, true);
    assert.equal(library.ok, true);
    assert.deepEqual(library.ok && library.value[0], {
      book: {
        id: 'pdf-book',
        title: 'Offline Catalogue',
        format: 'pdf',
        fileUri: 'file:///documents/reebbon/books/pdf-book/book.pdf',
        coverUri: 'file:///documents/reebbon/books/pdf-book/cover.jpg',
        totalPages: 2,
        createdAt: new Date('2026-09-07T10:00:00.000Z'),
      },
      progress: 0,
    });
    assert.deepEqual(
      fileSystem.fileBytes.get(
        'file:///documents/reebbon/books/pdf-book/book.pdf',
      ),
      pdfBytes,
    );
    assert.deepEqual(
      fileSystem.fileBytes.get(
        'file:///documents/reebbon/books/pdf-book/cover.jpg',
      ),
      coverBytes,
    );
    assert.equal(fullSourceReads, 0);
  } finally {
    await connection.close();
  }
});
