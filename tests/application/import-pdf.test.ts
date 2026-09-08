/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPdfImporter,
  type BookContentStore,
  type BookMetadataExtractor,
  type BookRepository,
  type ImportFormatDetector,
} from '../../src/application';
import { err, ok, type Book } from '../../src/domain';

const source = {
  kind: 'file',
  uri: 'content://picker/catalogue.pdf',
  name: 'Catalogue raisonné.pdf',
  mimeType: 'application/pdf',
} as const;
const coverBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

interface HarnessOptions {
  readonly failSave?: boolean;
  readonly failMetadataUnexpectedly?: boolean;
  readonly detectedFormat?: 'epub' | 'pdf';
  readonly metadata?: {
    readonly title?: string;
    readonly author?: string;
    readonly totalPages?: number;
  };
}

function createHarness(options: HarnessOptions = {}) {
  const calls: string[] = [];
  let savedBook: Book | undefined;
  const books: Pick<BookRepository, 'save' | 'delete'> = {
    save(book) {
      calls.push(`save:${book.id}`);
      savedBook = book;
      return Promise.resolve(
        options.failSave
          ? err({ kind: 'persistence-failure', operation: 'write' })
          : ok(undefined),
      );
    },
    delete(bookId) {
      calls.push(`delete:${bookId}`);
      return Promise.resolve(ok(undefined));
    },
  };
  const content: BookContentStore = {
    initialize: async () => ok(undefined),
    createStagingArea(importId) {
      calls.push(`create-staging:${importId}`);
      return Promise.resolve(ok({ id: importId, uri: `file:///cache/${importId}` }));
    },
    stageFile(importId, sourceUri, destinationName) {
      calls.push(`stage:${importId}:${sourceUri}:${destinationName}`);
      return Promise.resolve(ok(`file:///cache/${importId}/${destinationName}`));
    },
    stageBytes(importId, bytes, destinationName) {
      calls.push(`stage-bytes:${importId}:${bytes.byteLength}:${destinationName}`);
      return Promise.resolve(ok(`file:///cache/${importId}/${destinationName}`));
    },
    commitStagingArea(importId, bookId) {
      calls.push(`commit:${importId}:${bookId}`);
      return Promise.resolve(ok({ bookId, uri: `file:///books/${bookId}` }));
    },
    removeStagingArea(importId) {
      calls.push(`remove-staging:${importId}`);
      return Promise.resolve(ok(undefined));
    },
    removeBookFiles(bookId) {
      calls.push(`remove-book:${bookId}`);
      return Promise.resolve(ok(undefined));
    },
  };
  const detector: ImportFormatDetector = {
    detect: async () => ok(options.detectedFormat ?? 'pdf'),
  };
  const metadata: BookMetadataExtractor<'pdf'> = {
    format: 'pdf',
    async extract() {
      if (options.failMetadataUnexpectedly) {
        throw new Error('Native metadata boundary failed unexpectedly.');
      }
      return ok({
        title: 'Catalogue de l’exposition',
        author: 'Musée Reebbon',
        totalPages: 84,
        ...options.metadata,
        cover: { bytes: coverBytes, mediaType: 'image/jpeg' },
      });
    },
  };
  const identifiers = ['pdf-book', 'pdf-job'];
  const importer = createPdfImporter({
    books,
    content,
    detector,
    metadata,
    createId() {
      const id = identifiers.shift();
      if (id === undefined) {
        throw new Error('No identifier available.');
      }
      return id;
    },
    now: () => new Date('2026-09-07T10:00:00.000Z'),
  });
  return { calls, getSavedBook: () => savedBook, importer };
}

test('PDF importer uses the common staged pipeline and persists PDF metadata', async () => {
  const harness = createHarness();

  const result = await harness.importer.importBook(source);

  assert.equal(result.ok, true);
  assert.deepEqual(harness.getSavedBook(), {
    id: 'pdf-book',
    title: 'Catalogue de l’exposition',
    author: 'Musée Reebbon',
    format: 'pdf',
    fileUri: 'file:///books/pdf-book/book.pdf',
    coverUri: 'file:///books/pdf-book/cover.jpg',
    totalPages: 84,
    createdAt: new Date('2026-09-07T10:00:00.000Z'),
  });
  assert.deepEqual(harness.calls, [
    'create-staging:import-pdf-job',
    'stage:import-pdf-job:content://picker/catalogue.pdf:book.pdf',
    'stage-bytes:import-pdf-job:4:cover.jpg',
    'commit:import-pdf-job:pdf-book',
    'save:pdf-book',
  ]);
});

test('PDF importer falls back to the file name and ignores invalid page counts', async () => {
  const harness = createHarness({
    metadata: { title: '', author: '', totalPages: 0 },
  });

  assert.equal((await harness.importer.importBook(source)).ok, true);
  assert.equal(harness.getSavedBook()?.title, 'Catalogue raisonné');
  assert.equal(harness.getSavedBook()?.author, undefined);
  assert.equal(harness.getSavedBook()?.totalPages, undefined);
});

test('PDF importer rejects another detected format before staging', async () => {
  const harness = createHarness({ detectedFormat: 'epub' });

  assert.deepEqual(await harness.importer.importBook(source), {
    ok: false,
    error: { kind: 'unsupported-format', detectedFormat: 'epub' },
  });
  assert.deepEqual(harness.calls, []);
});

test('PDF importer types unexpected extraction failures before staging', async () => {
  const harness = createHarness({ failMetadataUnexpectedly: true });

  assert.deepEqual(await harness.importer.importBook(source), {
    ok: false,
    error: { kind: 'metadata-extraction-failure', format: 'pdf' },
  });
  assert.deepEqual(harness.calls, []);
});

test('PDF importer compensates database and file changes after save failure', async () => {
  const harness = createHarness({ failSave: true });

  assert.deepEqual(await harness.importer.importBook(source), {
    ok: false,
    error: { kind: 'persistence-failure', operation: 'save' },
  });
  assert.deepEqual(harness.calls.slice(-3), [
    'delete:pdf-book',
    'remove-book:pdf-book',
    'remove-staging:import-pdf-job',
  ]);
});
