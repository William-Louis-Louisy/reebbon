/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareNaturalFileNames,
  createImageDirectoryImporter,
  type BookContentStore,
  type BookRepository,
  type ImportDirectoryEntry,
  type ImportFileReader,
  type ImportFormatDetector,
} from '../../src/application';
import { err, ok, type Book } from '../../src/domain';

const source = {
  kind: 'directory',
  uri: 'content://picker/album',
  name: 'Les aventures',
} as const;
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface HarnessOptions {
  readonly entries?: readonly ImportDirectoryEntry[];
  readonly failList?: boolean;
  readonly failSave?: boolean;
  readonly failStageDestination?: string;
  readonly prefixes?: Readonly<Record<string, Uint8Array>>;
}

function createHarness(options: HarnessOptions = {}) {
  const calls: string[] = [];
  let savedBook: Book | undefined;
  const entries = options.entries ?? [
    { kind: 'file', uri: 'content://album/page_10.JPG', name: 'page_10.JPG' },
    { kind: 'file', uri: 'content://album/page_2.png', name: 'page_2.png' },
    { kind: 'file', uri: 'content://album/page_001.jpg', name: 'page_001.jpg' },
    { kind: 'file', uri: 'content://album/notes.txt', name: 'notes.txt' },
    { kind: 'directory', uri: 'content://album/chapter', name: 'chapter' },
  ];
  const prefixes = options.prefixes ?? {
    'content://album/page_10.JPG': jpeg,
    'content://album/page_2.png': png,
    'content://album/page_001.jpg': jpeg,
  };
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
      return Promise.resolve(
        destinationName === options.failStageDestination
          ? err({ kind: 'filesystem-failure', operation: 'stage-file' })
          : ok(`file:///cache/${importId}/${destinationName}`),
      );
    },
    stageBytes: async () => ok('file:///unused'),
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
    detect: async () => ok('image-directory'),
  };
  const files: Pick<ImportFileReader, 'readPrefix'> = {
    readPrefix(uri, byteLength) {
      calls.push(`prefix:${uri}:${byteLength}`);
      const bytes = prefixes[uri];
      return Promise.resolve(
        bytes === undefined
          ? err({ kind: 'permission-or-access-failure' })
          : ok(bytes.slice(0, byteLength)),
      );
    },
  };
  const identifiers = ['image-book', 'image-job'];
  const importer = createImageDirectoryImporter({
    books,
    content,
    detector,
    directories: {
      list: async () =>
        options.failList
          ? err({ kind: 'permission-or-access-failure' })
          : ok(entries),
    },
    files,
    createId() {
      const id = identifiers.shift();
      if (id === undefined) {
        throw new Error('No identifier available.');
      }
      return id;
    },
    now: () => new Date('2026-09-09T10:00:00.000Z'),
  });

  return { calls, getSavedBook: () => savedBook, importer };
}

test('natural image ordering compares numeric segments instead of lexical digits', () => {
  const names = ['page_10.jpg', 'page_2.jpg', 'page_001.jpg', 'page_20.jpg'];

  assert.deepEqual(names.sort(compareNaturalFileNames), [
    'page_001.jpg',
    'page_2.jpg',
    'page_10.jpg',
    'page_20.jpg',
  ]);
});

test('image-directory importer filters, validates and persists ordered images', async () => {
  const harness = createHarness();

  const result = await harness.importer.importBook({
    ...source,
    title: '  Album personnalisé  ',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(harness.getSavedBook(), {
    id: 'image-book',
    title: 'Album personnalisé',
    format: 'images',
    fileUri: 'file:///books/image-book',
    coverUri: 'file:///books/image-book/page-000001.jpg',
    totalPages: 3,
    createdAt: new Date('2026-09-09T10:00:00.000Z'),
  });
  assert.deepEqual(
    harness.calls.filter((call) => call.startsWith('stage:')),
    [
      'stage:import-image-job:content://album/page_001.jpg:page-000001.jpg',
      'stage:import-image-job:content://album/page_2.png:page-000002.png',
      'stage:import-image-job:content://album/page_10.JPG:page-000003.jpg',
    ],
  );
  assert.deepEqual(
    harness.calls.filter((call) => call.startsWith('prefix:')),
    [
      'prefix:content://album/page_001.jpg:8',
      'prefix:content://album/page_2.png:8',
      'prefix:content://album/page_10.JPG:8',
    ],
  );
});

test('image-directory importer uses the directory name as its default title', async () => {
  const harness = createHarness();

  assert.equal((await harness.importer.importBook(source)).ok, true);
  assert.equal(harness.getSavedBook()?.title, 'Les aventures');
});

test('empty, unreadable and corrupted directories fail before persistence', async (t) => {
  await t.test('no supported images', async () => {
    const harness = createHarness({
      entries: [
        { kind: 'file', uri: 'content://album/readme.txt', name: 'readme.txt' },
      ],
    });

    assert.deepEqual(await harness.importer.importBook(source), {
      ok: false,
      error: { kind: 'corrupted-source', format: 'image-directory' },
    });
    assert.deepEqual(harness.calls, []);
  });

  await t.test('directory access denied', async () => {
    const harness = createHarness({ failList: true });

    assert.deepEqual(await harness.importer.importBook(source), {
      ok: false,
      error: { kind: 'permission-or-access-failure', source },
    });
    assert.deepEqual(harness.calls, []);
  });

  await t.test('extension and signature disagree', async () => {
    const harness = createHarness({
      entries: [
        { kind: 'file', uri: 'content://album/page.jpg', name: 'page.jpg' },
      ],
      prefixes: { 'content://album/page.jpg': png },
    });

    assert.deepEqual(await harness.importer.importBook(source), {
      ok: false,
      error: { kind: 'corrupted-source', format: 'image-directory' },
    });
    assert.deepEqual(
      harness.calls.filter((call) => call.startsWith('create-staging:')),
      [],
    );
  });
});

test('image-directory importer removes database and files after save failure', async () => {
  const harness = createHarness({ failSave: true });

  assert.deepEqual(await harness.importer.importBook(source), {
    ok: false,
    error: { kind: 'persistence-failure', operation: 'save' },
  });
  assert.deepEqual(harness.calls.slice(-3), [
    'delete:image-book',
    'remove-book:image-book',
    'remove-staging:import-image-job',
  ]);
});

test('image-directory importer removes a partially copied staging area', async () => {
  const harness = createHarness({ failStageDestination: 'page-000002.png' });

  assert.deepEqual(await harness.importer.importBook(source), {
    ok: false,
    error: { kind: 'filesystem-failure', operation: 'copy' },
  });
  assert.deepEqual(harness.calls.slice(-2), [
    'stage:import-image-job:content://album/page_2.png:page-000002.png',
    'remove-staging:import-image-job',
  ]);
  assert.equal(harness.calls.some((call) => call.startsWith('commit:')), false);
  assert.equal(harness.calls.some((call) => call.startsWith('save:')), false);
});
