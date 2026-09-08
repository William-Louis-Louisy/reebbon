/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { PdfPageImageGateway } from '../../src/infrastructure/pdf/pdf-page-image-gateway';
import { NativePdfPageThumbnailProvider } from '../../src/infrastructure/reading/native-pdf-page-thumbnail-provider';

interface HarnessOptions {
  readonly failClose?: boolean;
  readonly failGenerate?: boolean;
  readonly failOpen?: boolean;
  readonly pageCount?: number;
  readonly renderedUri?: string;
}

function createHarness(options: HarnessOptions = {}) {
  const calls: string[] = [];
  const gateway: PdfPageImageGateway = {
    async open(uri) {
      calls.push(`open:${uri}`);
      if (options.failOpen) {
        throw new Error('Open failed.');
      }
      return { pageCount: options.pageCount ?? 20 };
    },
    async generate(uri, page, scale, renderOptions) {
      calls.push(
        `generate:${uri}:${page}:${scale}:${renderOptions.format}:${renderOptions.quality}:${renderOptions.maxDimension}`,
      );
      if (options.failGenerate) {
        throw new Error('Render failed.');
      }
      return {
        uri: options.renderedUri ?? 'file:///cache/page.jpg',
        width: 180,
        height: 252,
      };
    },
    async close(uri) {
      calls.push(`close:${uri}`);
      if (options.failClose) {
        throw new Error('Close failed.');
      }
    },
  };
  const provider = new NativePdfPageThumbnailProvider(async () => gateway);
  return { calls, provider };
}

test('PDF thumbnails translate reader pages to bounded native JPEG renders', async () => {
  const harness = createHarness();

  assert.deepEqual(await harness.provider.open('file:///books/book.pdf', 20), {
    ok: true,
    value: undefined,
  });
  assert.deepEqual(await harness.provider.render(7), {
    ok: true,
    value: {
      page: 7,
      uri: 'file:///cache/page.jpg',
      width: 180,
      height: 252,
    },
  });
  assert.deepEqual(await harness.provider.close(), {
    ok: true,
    value: undefined,
  });
  assert.deepEqual(harness.calls, [
    'open:file:///books/book.pdf',
    'generate:file:///books/book.pdf:6:1:jpeg:76:320',
    'close:file:///books/book.pdf',
  ]);
});

test('PDF thumbnail provider rejects invalid pages before native rendering', async () => {
  const harness = createHarness();

  assert.deepEqual(await harness.provider.render(1), {
    ok: false,
    error: { kind: 'not-open' },
  });
  await harness.provider.open('file:///books/book.pdf', 20);
  for (const page of [0, 21, 1.5]) {
    assert.deepEqual(await harness.provider.render(page), {
      ok: false,
      error: { kind: 'invalid-page', page },
    });
  }
  assert.equal(harness.calls.some((call) => call.startsWith('generate:')), false);
});

test('PDF thumbnail source and render failures remain typed', async (context) => {
  await context.test('native open failure', async () => {
    const harness = createHarness({ failOpen: true });
    assert.deepEqual(await harness.provider.open('file:///book.pdf', 20), {
      ok: false,
      error: { kind: 'thumbnail-source-failure' },
    });
  });

  await context.test('page count mismatch', async () => {
    const harness = createHarness({ pageCount: 19 });
    assert.deepEqual(await harness.provider.open('file:///book.pdf', 20), {
      ok: false,
      error: { kind: 'thumbnail-source-failure' },
    });
    assert.deepEqual(harness.calls, [
      'open:file:///book.pdf',
      'close:file:///book.pdf',
    ]);
  });

  await context.test('native render failure', async () => {
    const harness = createHarness({ failGenerate: true });
    await harness.provider.open('file:///book.pdf', 20);
    assert.deepEqual(await harness.provider.render(1), {
      ok: false,
      error: { kind: 'thumbnail-rendering-failure' },
    });
  });

  await context.test('malformed native image', async () => {
    const harness = createHarness({ renderedUri: '   ' });
    await harness.provider.open('file:///book.pdf', 20);
    assert.deepEqual(await harness.provider.render(1), {
      ok: false,
      error: { kind: 'thumbnail-rendering-failure' },
    });
  });
});

test('PDF thumbnail cleanup failure is typed and closes the session', async () => {
  const harness = createHarness({ failClose: true });
  await harness.provider.open('file:///book.pdf', 20);

  assert.deepEqual(await harness.provider.close(), {
    ok: false,
    error: { kind: 'thumbnail-cleanup-failure' },
  });
  assert.deepEqual(await harness.provider.render(1), {
    ok: false,
    error: { kind: 'not-open' },
  });
});
