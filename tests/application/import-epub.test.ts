/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEpubImporter,
  type BookContentStore,
  type BookMetadataExtractor,
  type BookRepository,
  type ExtractedBookMetadata,
  type ImportFormat,
  type ImportFormatDetector,
  type MetadataExtractionError,
} from '../../src/application';
import { err, ok, type Book } from '../../src/domain';

const source = {
  kind: 'file',
  uri: 'content://picker/les-villes.epub',
  name: 'Les Villes invisibles.epub',
  mimeType: 'application/epub+zip',
} as const;

const extractedMetadata: ExtractedBookMetadata = {
  title: 'Le citta invisibili',
  author: 'Italo Calvino',
  cover: {
    mediaType: 'image/jpeg',
    bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  },
};

interface ImportHarnessOptions {
  readonly detectedFormat?: ImportFormat;
  readonly metadata?: ExtractedBookMetadata;
  readonly metadataError?: MetadataExtractionError;
  readonly failCover?: boolean;
  readonly failStage?: boolean;
  readonly failSave?: boolean;
}

function createImportHarness(options: ImportHarnessOptions = {}) {
  const calls: string[] = [];
  let savedBook: Book | undefined;
  const ids = ['book-1', 'job-1'];
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
    initialize: () => Promise.resolve(ok(undefined)),
    createStagingArea(importId) {
      calls.push(`create-staging:${importId}`);
      return Promise.resolve(ok({ id: importId, uri: `file:///cache/${importId}` }));
    },
    stageFile(importId, sourceUri, destinationName) {
      calls.push(`stage:${importId}:${sourceUri}:${destinationName}`);
      return Promise.resolve(
        options.failStage
          ? err({
              kind: 'permission-or-access-failure',
              operation: 'stage-file',
            })
          : ok(`file:///cache/${importId}/${destinationName}`),
      );
    },
    stageBytes(importId, bytes, destinationName) {
      calls.push(`stage-bytes:${importId}:${bytes.byteLength}:${destinationName}`);
      return Promise.resolve(
        options.failCover
          ? err({ kind: 'filesystem-failure', operation: 'stage-bytes' })
          : ok(`file:///cache/${importId}/${destinationName}`),
      );
    },
    commitStagingArea(importId, bookId) {
      calls.push(`commit:${importId}:${bookId}`);
      return Promise.resolve(ok({ bookId, uri: `file:///documents/books/${bookId}` }));
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
    detect(candidate) {
      calls.push(`detect:${candidate.name}`);
      const detected =
        options.detectedFormat ??
        (candidate.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub');
      return Promise.resolve(ok(detected));
    },
  };
  const metadata: BookMetadataExtractor<'epub'> = {
    format: 'epub',
    extract(candidate) {
      calls.push(`metadata:${candidate.name}`);
      return Promise.resolve(
        options.metadataError === undefined
          ? ok(options.metadata ?? extractedMetadata)
          : err(options.metadataError),
      );
    },
  };
  const importer = createEpubImporter({
    books,
    content,
    detector,
    metadata,
    createId() {
      const id = ids.shift();
      if (id === undefined) {
        throw new Error('No deterministic identifier available.');
      }
      return id;
    },
    now: () => new Date('2026-09-02T12:00:00.000Z'),
  });

  return {
    calls,
    importer,
    getSavedBook: () => savedBook,
  };
}

test('EPUB importer detects, extracts, stages, and persists validated metadata', async () => {
  const harness = createImportHarness();

  const result = await harness.importer.importBook(source);

  assert.equal(result.ok, true);
  assert.deepEqual(harness.calls, [
    'detect:Les Villes invisibles.epub',
    'metadata:Les Villes invisibles.epub',
    'create-staging:import-job-1',
    'stage:import-job-1:content://picker/les-villes.epub:book.epub',
    'stage-bytes:import-job-1:4:cover.jpg',
    'commit:import-job-1:book-1',
    'save:book-1',
  ]);
  assert.deepEqual(harness.getSavedBook(), {
    id: 'book-1',
    title: 'Le citta invisibili',
    author: 'Italo Calvino',
    format: 'epub',
    fileUri: 'file:///documents/books/book-1/book.epub',
    coverUri: 'file:///documents/books/book-1/cover.jpg',
    createdAt: new Date('2026-09-02T12:00:00.000Z'),
  });
});

test('EPUB importer falls back to the file name when OPF metadata is absent', async () => {
  const harness = createImportHarness({ metadata: {} });

  const result = await harness.importer.importBook(source);

  assert.equal(result.ok, true);
  assert.equal(harness.getSavedBook()?.title, 'Les Villes invisibles');
  assert.equal(harness.getSavedBook()?.author, undefined);
  assert.equal(harness.getSavedBook()?.coverUri, undefined);
  assert.equal(harness.calls.some((call) => call.startsWith('stage-bytes:')), false);
});

test('EPUB importer rejects invalid extracted text and unsafe file-name fallback', async () => {
  const harness = createImportHarness({
    metadata: {
      title: 'x'.repeat(501),
      author: 'invalid\u0001author',
    },
  });

  const result = await harness.importer.importBook({
    ...source,
    name: `${'x'.repeat(501)}.epub`,
  });

  assert.equal(result.ok, true);
  assert.equal(harness.getSavedBook()?.title, 'Ouvrage EPUB');
  assert.equal(harness.getSavedBook()?.author, undefined);
});

test('EPUB importer rejects a detected PDF before extraction or storage', async () => {
  const harness = createImportHarness();

  const result = await harness.importer.importBook({
    ...source,
    name: 'document.pdf',
  });

  assert.deepEqual(result, {
    ok: false,
    error: { kind: 'unsupported-format', detectedFormat: 'pdf' },
  });
  assert.deepEqual(harness.calls, ['detect:document.pdf']);
});

test('EPUB importer stops before storage when metadata extraction fails', async () => {
  const harness = createImportHarness({
    metadataError: { kind: 'metadata-extraction-failure', format: 'epub' },
  });

  const result = await harness.importer.importBook(source);

  assert.deepEqual(result, {
    ok: false,
    error: { kind: 'metadata-extraction-failure', format: 'epub' },
  });
  assert.deepEqual(harness.calls, [
    'detect:Les Villes invisibles.epub',
    'metadata:Les Villes invisibles.epub',
  ]);
});

test('EPUB importer removes staging after an inaccessible source', async () => {
  const harness = createImportHarness({ failStage: true });

  const result = await harness.importer.importBook(source);

  assert.deepEqual(result, {
    ok: false,
    error: { kind: 'permission-or-access-failure', source },
  });
  assert.deepEqual(harness.calls.slice(-3), [
    'create-staging:import-job-1',
    'stage:import-job-1:content://picker/les-villes.epub:book.epub',
    'remove-staging:import-job-1',
  ]);
});

test('EPUB importer removes staging when the extracted cover cannot be written', async () => {
  const harness = createImportHarness({ failCover: true });

  const result = await harness.importer.importBook(source);

  assert.deepEqual(result, {
    ok: false,
    error: { kind: 'filesystem-failure', operation: 'copy' },
  });
  assert.deepEqual(harness.calls.slice(-2), [
    'stage-bytes:import-job-1:4:cover.jpg',
    'remove-staging:import-job-1',
  ]);
});

test('EPUB importer rolls back database and owned files after persistence failure', async () => {
  const harness = createImportHarness({ failSave: true });

  const result = await harness.importer.importBook(source);

  assert.deepEqual(result, {
    ok: false,
    error: { kind: 'persistence-failure', operation: 'save' },
  });
  assert.deepEqual(harness.calls.slice(-3), [
    'delete:book-1',
    'remove-book:book-1',
    'remove-staging:import-job-1',
  ]);
});
