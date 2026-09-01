/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEpubImporter,
  type BookContentStore,
  type BookRepository,
} from '../../src/application';
import { err, ok, type Book } from '../../src/domain';

const source = {
  kind: 'file',
  uri: 'content://picker/les-villes.epub',
  name: 'Les Villes invisibles.epub',
  mimeType: 'application/epub+zip',
} as const;

interface ImportHarnessOptions {
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
  const importer = createEpubImporter({
    books,
    content,
    createId() {
      const id = ids.shift();
      if (id === undefined) {
        throw new Error('No deterministic identifier available.');
      }
      return id;
    },
    now: () => new Date('2026-09-01T12:00:00.000Z'),
  });

  return {
    calls,
    importer,
    getSavedBook: () => savedBook,
  };
}

test('EPUB importer stages, commits, and persists a local book through common ports', async () => {
  const harness = createImportHarness();

  const result = await harness.importer.importBook(source);

  assert.equal(result.ok, true);
  assert.deepEqual(harness.calls, [
    'create-staging:import-job-1',
    'stage:import-job-1:content://picker/les-villes.epub:book.epub',
    'commit:import-job-1:book-1',
    'save:book-1',
  ]);
  assert.deepEqual(harness.getSavedBook(), {
    id: 'book-1',
    title: 'Les Villes invisibles',
    format: 'epub',
    fileUri: 'file:///documents/books/book-1/book.epub',
    createdAt: new Date('2026-09-01T12:00:00.000Z'),
  });
});

test('EPUB importer rejects another extension before touching storage', async () => {
  const harness = createImportHarness();

  const result = await harness.importer.importBook({
    ...source,
    name: 'document.pdf',
  });

  assert.deepEqual(result, {
    ok: false,
    error: { kind: 'unsupported-format', detectedFormat: 'pdf' },
  });
  assert.deepEqual(harness.calls, []);
});

test('EPUB importer removes staging after an inaccessible source', async () => {
  const harness = createImportHarness({ failStage: true });

  const result = await harness.importer.importBook(source);

  assert.deepEqual(result, {
    ok: false,
    error: { kind: 'permission-or-access-failure', source },
  });
  assert.deepEqual(harness.calls, [
    'create-staging:import-job-1',
    'stage:import-job-1:content://picker/les-villes.epub:book.epub',
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
