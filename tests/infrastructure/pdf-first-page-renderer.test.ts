/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { ImportFileReader } from '../../src/application';
import { err, ok } from '../../src/domain';
import {
  ExpoPdfFirstPageRenderer,
  type PdfPageImageGateway,
} from '../../src/infrastructure/importing/pdf-first-page-renderer';

const source = {
  kind: 'file',
  uri: 'content://picker/book.pdf',
  name: 'book.pdf',
} as const;
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xd9]);

interface HarnessOptions {
  readonly pageCount?: number;
  readonly failOpen?: boolean;
  readonly failGenerate?: boolean;
  readonly failClose?: boolean;
  readonly imageBytes?: Uint8Array;
}

function createHarness(options: HarnessOptions = {}) {
  const calls: string[] = [];
  const gateway: PdfPageImageGateway = {
    async open(uri) {
      calls.push(`open:${uri}`);
      if (options.failOpen) {
        throw new Error('Cannot open PDF.');
      }
      return { pageCount: options.pageCount ?? 12 };
    },
    async generate(uri, page, scale, renderOptions) {
      calls.push(
        `generate:${uri}:${page}:${scale}:${renderOptions.format}:${renderOptions.quality}:${renderOptions.maxDimension}`,
      );
      if (options.failGenerate) {
        throw new Error('Cannot render PDF.');
      }
      return { uri: 'file:///cache/cover.jpg', width: 420, height: 640 };
    },
    async close(uri) {
      calls.push(`close:${uri}`);
      if (options.failClose) {
        throw new Error('Cannot close PDF.');
      }
    },
  };
  const files: Pick<ImportFileReader, 'readAll'> = {
    readAll(uri) {
      calls.push(`read:${uri}`);
      return Promise.resolve(ok(options.imageBytes ?? jpeg));
    },
  };
  const renderer = new ExpoPdfFirstPageRenderer(files, async () => gateway);
  return { calls, renderer };
}

test('PDF first-page renderer creates a bounded JPEG cover and reports page count', async () => {
  const harness = createHarness();

  assert.deepEqual(await harness.renderer.render(source), {
    ok: true,
    value: {
      cover: { bytes: jpeg, mediaType: 'image/jpeg' },
      totalPages: 12,
    },
  });
  assert.deepEqual(harness.calls, [
    'open:content://picker/book.pdf',
    'generate:content://picker/book.pdf:0:1:jpeg:82:640',
    'read:file:///cache/cover.jpg',
    'close:content://picker/book.pdf',
  ]);
});

test('an unopenable or empty PDF is reported as corrupted', async (context) => {
  for (const options of [{ failOpen: true }, { pageCount: 0 }]) {
    await context.test(JSON.stringify(options), async () => {
      const harness = createHarness(options);
      assert.deepEqual(await harness.renderer.render(source), {
        ok: false,
        error: { kind: 'corrupted-source', format: 'pdf' },
      });
      assert.equal(harness.calls.includes('close:content://picker/book.pdf'), true);
    });
  }
});

test('PDF extraction settles only after native resources are closed', async () => {
  let settled = false;
  let releaseClose: () => void = () => undefined;
  let reportCloseStarted: () => void = () => undefined;
  const closeGate = new Promise<void>((resolve) => {
    releaseClose = resolve;
  });
  const closeStarted = new Promise<void>((resolve) => {
    reportCloseStarted = resolve;
  });
  const gateway: PdfPageImageGateway = {
    open: async () => ({ pageCount: 1 }),
    generate: async () => ({
      uri: 'file:///cache/cover.jpg',
      width: 420,
      height: 640,
    }),
    async close() {
      reportCloseStarted();
      await closeGate;
    },
  };
  const files: Pick<ImportFileReader, 'readAll'> = {
    readAll: async () => ok(jpeg),
  };
  const renderer = new ExpoPdfFirstPageRenderer(files, async () => gateway);

  const rendering = renderer.render(source).then((result) => {
    settled = true;
    return result;
  });
  await closeStarted;

  assert.equal(settled, false);
  releaseClose();
  assert.equal((await rendering).ok, true);
  assert.equal(settled, true);
});

test('a close failure after an open failure remains typed', async () => {
  const harness = createHarness({ failOpen: true, failClose: true });

  assert.deepEqual(await harness.renderer.render(source), {
    ok: false,
    error: { kind: 'metadata-extraction-failure', format: 'pdf' },
  });
  assert.deepEqual(harness.calls, [
    'open:content://picker/book.pdf',
    'close:content://picker/book.pdf',
  ]);
});

test('render, generated-file, and cleanup failures remain typed', async (context) => {
  for (const options of [
    { failGenerate: true },
    { imageBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
    { failClose: true },
  ]) {
    await context.test(JSON.stringify(options), async () => {
      const harness = createHarness(options);
      assert.deepEqual(await harness.renderer.render(source), {
        ok: false,
        error: { kind: 'metadata-extraction-failure', format: 'pdf' },
      });
      assert.equal(
        harness.calls.includes('close:content://picker/book.pdf'),
        true,
      );
    });
  }
});

test('an inaccessible generated cover is a metadata extraction failure', async () => {
  const gateway: PdfPageImageGateway = {
    open: async () => ({ pageCount: 1 }),
    generate: async () => ({
      uri: 'file:///cache/missing.jpg',
      width: 100,
      height: 100,
    }),
    close: async () => undefined,
  };
  const files: Pick<ImportFileReader, 'readAll'> = {
    readAll: async () => err({ kind: 'permission-or-access-failure' }),
  };

  const renderer = new ExpoPdfFirstPageRenderer(files, async () => gateway);
  assert.deepEqual(await renderer.render(source), {
    ok: false,
    error: { kind: 'metadata-extraction-failure', format: 'pdf' },
  });
});
