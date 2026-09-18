/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCbrImporter,
  defaultCbrTitle,
  type CbrArchiveExtractionError,
  type CbrArchiveExtractor,
  type ImageDirectoryImportPipeline,
  type ImportError,
  type ImportResult,
  type ImportFormatDetector,
  type ReaderFormatForImport,
} from '../../src/application';
import { err, ok, type Book, type Result } from '../../src/domain';

const source = {
  kind: 'file',
  uri: 'content://picker/volume.cbr',
  name: 'Volume 04.CBR',
} as const;

interface HarnessOptions {
  readonly extractionError?: CbrArchiveExtractionError;
  readonly imageError?: ImportError;
  readonly cleanupError?: CbrArchiveExtractionError;
}

function createHarness(options: HarnessOptions = {}) {
  const events: string[] = [];
  let delegated:
    | {
        readonly source: Parameters<ImageDirectoryImportPipeline['importDirectory']>[0];
        readonly context: Parameters<ImageDirectoryImportPipeline['importDirectory']>[1];
      }
    | undefined;
  const detector: ImportFormatDetector = {
    detect: async () => ok('cbr'),
  };
  const archives: CbrArchiveExtractor = {
    async extract(_source, extractionId) {
      events.push(`extract:${extractionId}`);
      return options.extractionError === undefined
        ? ok({
            uri: 'file:///cache/reebbon-cbr/cbr-job/extracted',
            entryCount: 3,
            fileCount: 3,
            totalBytes: 42,
            solid: false,
          })
        : err(options.extractionError);
    },
    async cleanup(extractionId) {
      events.push(`cleanup:${extractionId}`);
      return options.cleanupError === undefined
        ? ok(undefined)
        : err(options.cleanupError);
    },
  };
  const images: ImageDirectoryImportPipeline = {
    async importDirectory<F extends 'image-directory' | 'cbz' | 'cbr'>(
      directory: Parameters<ImageDirectoryImportPipeline['importDirectory']>[0],
      context: Parameters<ImageDirectoryImportPipeline['importDirectory']>[1],
    ): Promise<Result<ImportResult<F>, ImportError>> {
      delegated = { source: directory, context };
      events.push('images');
      const afterStaging = await context.afterStaging?.();
      if (afterStaging !== undefined && !afterStaging.ok) {
        return afterStaging;
      }
      if (options.imageError !== undefined) {
        return err(options.imageError);
      }
      const book = {
              id: 'book-cbr',
              title: directory.title ?? directory.name,
              format: 'images',
              fileUri: 'file:///documents/books/book-cbr',
              coverUri: 'file:///documents/books/book-cbr/page-000001.jpg',
              totalPages: 3,
              createdAt: new Date('2026-09-18T08:00:00.000Z'),
            } as Book<ReaderFormatForImport<F>>;
      return ok({ book });
    },
  };
  return {
    events,
    delegated: () => delegated,
    importer: createCbrImporter({
      archives,
      detector,
      images,
      createExtractionId: () => 'job',
    }),
  };
}

test('CBR import delegates extracted files to the shared Images pipeline and cleans after staging', async () => {
  const harness = createHarness();

  const imported = await harness.importer.importBook({
    ...source,
    title: 'Titre choisi',
  });

  assert.equal(imported.ok, true);
  assert.deepEqual(harness.events, [
    'extract:cbr-job',
    'images',
    'cleanup:cbr-job',
  ]);
  assert.deepEqual(harness.delegated()?.source, {
    kind: 'directory',
    uri: 'file:///cache/reebbon-cbr/cbr-job/extracted',
    name: 'Volume 04',
    title: 'Titre choisi',
  });
  assert.deepEqual(harness.delegated()?.context.format, 'cbr');
  assert.deepEqual(harness.delegated()?.context.source, {
    ...source,
    title: 'Titre choisi',
  });
});

test('CBR title defaults to the archive name and remains editable', () => {
  assert.equal(defaultCbrTitle('  Volume 02.CBR  '), 'Volume 02');
  assert.equal(defaultCbrTitle('.cbr'), 'Ouvrage CBR');
  assert.equal(defaultCbrTitle('Album'), 'Album');
});

test('CBR native rejection reasons remain explicit application errors', async (t) => {
  const cases = [
    [
      { kind: 'corrupted-archive' },
      { kind: 'corrupted-source', format: 'cbr' },
    ],
    [
      { kind: 'encrypted-archive' },
      { kind: 'archive-rejected', format: 'cbr', reason: 'encrypted' },
    ],
    [
      { kind: 'multi-volume-archive' },
      { kind: 'archive-rejected', format: 'cbr', reason: 'multi-volume' },
    ],
    [
      { kind: 'limits-exceeded' },
      { kind: 'archive-rejected', format: 'cbr', reason: 'limits-exceeded' },
    ],
    [
      { kind: 'unsafe-archive' },
      { kind: 'archive-rejected', format: 'cbr', reason: 'unsafe-contents' },
    ],
  ] as const;

  for (const [nativeError, expected] of cases) {
    await t.test(nativeError.kind, async () => {
      const harness = createHarness({ extractionError: nativeError });
      assert.deepEqual(await harness.importer.importBook(source), {
        ok: false,
        error: expected,
      });
      assert.deepEqual(harness.events, [
        'extract:cbr-job',
        'cleanup:cbr-job',
      ]);
    });
  }
});

test('CBR import cleans native files when the Images pipeline fails', async () => {
  const harness = createHarness({
    imageError: { kind: 'corrupted-source', format: 'cbr' },
  });

  assert.deepEqual(await harness.importer.importBook(source), {
    ok: false,
    error: { kind: 'corrupted-source', format: 'cbr' },
  });
  assert.deepEqual(harness.events, [
    'extract:cbr-job',
    'images',
    'cleanup:cbr-job',
  ]);
});

test('CBR cleanup failure is never hidden by an earlier import error', async () => {
  const harness = createHarness({
    extractionError: { kind: 'corrupted-archive' },
    cleanupError: { kind: 'filesystem-failure', operation: 'cleanup' },
  });

  assert.deepEqual(await harness.importer.importBook(source), {
    ok: false,
    error: { kind: 'filesystem-failure', operation: 'cleanup' },
  });
});
