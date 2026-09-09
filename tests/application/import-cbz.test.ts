/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCbzImporter,
  defaultCbzTitle,
  type CbzArchiveExtractionError,
  type CbzArchiveExtractor,
  type ImageDirectoryImportPipeline,
  type ImportError,
  type ImportFormatDetector,
  type ImportResult,
  type ReaderFormatForImport,
} from '../../src/application';
import { err, ok, type Book, type Result } from '../../src/domain';

const source = {
  kind: 'file',
  uri: 'file:///cache/volume.cbz',
  name: 'Volume 01.cbz',
  mimeType: 'application/vnd.comicbook+zip',
} as const;

interface HarnessOptions {
  readonly detectedFormat?: 'cbz' | 'epub';
  readonly extractionError?: CbzArchiveExtractionError;
  readonly imageError?: ImportError;
  readonly failCleanup?: boolean;
  readonly throwImagePipeline?: boolean;
}

function createHarness(options: HarnessOptions = {}) {
  const calls: string[] = [];
  let delegatedSource: Parameters<ImageDirectoryImportPipeline['importDirectory']>[0];
  const detector: ImportFormatDetector = {
    detect: async () => {
      calls.push('detect');
      return ok(options.detectedFormat ?? 'cbz');
    },
  };
  const archives: CbzArchiveExtractor = {
    extract(_selected, extractionId) {
      calls.push(`extract:${extractionId}`);
      return Promise.resolve(
        options.extractionError === undefined
          ? ok({ uri: `file:///cache/${extractionId}` })
          : err(options.extractionError),
      );
    },
    cleanup(extractionId) {
      calls.push(`cleanup:${extractionId}`);
      return Promise.resolve(
        options.failCleanup
          ? err({ kind: 'filesystem-failure', operation: 'cleanup' })
          : ok(undefined),
      );
    },
  };
  const images: ImageDirectoryImportPipeline = {
    async importDirectory<F extends 'image-directory' | 'cbz'>(
      directory: Parameters<ImageDirectoryImportPipeline['importDirectory']>[0],
      context: Parameters<ImageDirectoryImportPipeline['importDirectory']>[1],
    ): Promise<Result<ImportResult<F>, ImportError>> {
      calls.push(`images:${context.format}`);
      delegatedSource = directory;
      if (options.throwImagePipeline) {
        throw new Error('unexpected pipeline failure');
      }
      if (options.imageError !== undefined) {
        return err(options.imageError);
      }
      if (context.afterStaging !== undefined) {
        const cleaned = await context.afterStaging();
        if (!cleaned.ok) {
          return err(cleaned.error);
        }
      }
      const book = {
        id: 'book-cbz',
        title: directory.title ?? directory.name,
        format: 'images',
        fileUri: 'file:///books/book-cbz',
        coverUri: 'file:///books/book-cbz/page-000001.jpg',
        totalPages: 2,
        createdAt: new Date('2026-09-09T10:00:00.000Z'),
      } as Book<ReaderFormatForImport<F>>;
      return ok({ book });
    },
  };
  const importer = createCbzImporter({
    archives,
    detector,
    images,
    createExtractionId: () => 'extraction-job',
  });

  return { calls, getDelegatedSource: () => delegatedSource, importer };
}

test('CBZ importer extracts then delegates to the exact image-directory pipeline', async () => {
  const harness = createHarness();

  const result = await harness.importer.importBook(source);

  assert.equal(result.ok, true);
  assert.deepEqual(harness.getDelegatedSource(), {
    kind: 'directory',
    uri: 'file:///cache/cbz-extraction-job',
    name: 'Volume 01',
  });
  assert.deepEqual(harness.calls, [
    'detect',
    'extract:cbz-extraction-job',
    'images:cbz',
    'cleanup:cbz-extraction-job',
  ]);
});

test('CBZ title defaults to the archive name and remains editable', async () => {
  assert.equal(defaultCbzTitle('  Volume 02.CBZ  '), 'Volume 02');
  assert.equal(defaultCbzTitle('.cbz'), 'Ouvrage CBZ');

  const harness = createHarness();
  const result = await harness.importer.importBook({
    ...source,
    title: '  Titre personnalisé  ',
  });

  assert.equal(result.ok && result.value.book.title, 'Titre personnalisé');
  assert.equal(harness.getDelegatedSource()?.title, 'Titre personnalisé');
});

test('CBZ importer rejects another detected format before extraction', async () => {
  const harness = createHarness({ detectedFormat: 'epub' });

  assert.deepEqual(await harness.importer.importBook(source), {
    ok: false,
    error: { kind: 'unsupported-format', detectedFormat: 'epub' },
  });
  assert.deepEqual(harness.calls, ['detect']);
});

test('CBZ importer maps corrupt archives and removes extraction remnants', async () => {
  const harness = createHarness({
    extractionError: { kind: 'corrupted-archive' },
  });

  assert.deepEqual(await harness.importer.importBook(source), {
    ok: false,
    error: { kind: 'corrupted-source', format: 'cbz' },
  });
  assert.deepEqual(harness.calls, [
    'detect',
    'extract:cbz-extraction-job',
    'cleanup:cbz-extraction-job',
  ]);
});

test('CBZ importer cleans extraction after a delegated pipeline failure', async () => {
  const harness = createHarness({
    imageError: { kind: 'corrupted-source', format: 'cbz' },
  });

  assert.deepEqual(await harness.importer.importBook(source), {
    ok: false,
    error: { kind: 'corrupted-source', format: 'cbz' },
  });
  assert.equal(harness.calls.at(-1), 'cleanup:cbz-extraction-job');
});

test('CBZ importer types cleanup and unexpected pipeline failures', async (t) => {
  await t.test('cleanup failure', async () => {
    const harness = createHarness({ failCleanup: true });
    assert.deepEqual(await harness.importer.importBook(source), {
      ok: false,
      error: { kind: 'filesystem-failure', operation: 'cleanup' },
    });
  });

  await t.test('unexpected pipeline failure', async () => {
    const harness = createHarness({ throwImagePipeline: true });
    assert.deepEqual(await harness.importer.importBook(source), {
      ok: false,
      error: { kind: 'filesystem-failure', operation: 'stage' },
    });
    assert.equal(harness.calls.at(-1), 'cleanup:cbz-extraction-job');
  });
});
