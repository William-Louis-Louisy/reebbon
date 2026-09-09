/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { strToU8, zipSync } from 'fflate';

import {
  extractCbzChunks,
  type CbzExtractionFileWriter,
  type CbzExtractionLimits,
  type CbzExtractionTarget,
} from '../../src/infrastructure/importing/cbz-stream-extractor-core';

const defaultLimits: CbzExtractionLimits = {
  maxEntries: 10_000,
  maxEntryBytes: 512 * 1024 * 1024,
  maxTotalBytes: 4 * 1024 * 1024 * 1024,
  maxPathLength: 1024,
};

class MemoryExtractionTarget implements CbzExtractionTarget {
  public readonly directories = new Set<string>();
  public readonly files = new Map<string, number[]>();
  public openWriterCount = 0;

  public constructor(private readonly failWrites = false) {}

  public createDirectory(relativePath: string): void {
    this.directories.add(relativePath);
  }

  public createFile(relativePath: string): CbzExtractionFileWriter {
    const bytes: number[] = [];
    this.files.set(relativePath, bytes);
    this.openWriterCount += 1;
    let closed = false;
    return {
      write: (chunk) => {
        if (this.failWrites) {
          throw new Error('disk full');
        }
        bytes.push(...chunk);
      },
      close: () => {
        if (!closed) {
          closed = true;
          this.openWriterCount -= 1;
        }
      },
    };
  }
}

test('CBZ stream extraction writes root and nested files from bounded chunks', async () => {
  const archive = zipSync({
    'page_10.jpg': strToU8('ten'),
    'page_2.png': strToU8('two'),
    'extras/credits.txt': strToU8('credits'),
  });
  const target = new MemoryExtractionTarget();

  const result = await extractCbzChunks(chunk(archive, 7), target);

  assert.deepEqual(result, {
    ok: true,
    value: { fileCount: 3, totalBytes: 13 },
  });
  assert.deepEqual(target.files.get('page_10.jpg'), [...strToU8('ten')]);
  assert.deepEqual(target.files.get('page_2.png'), [...strToU8('two')]);
  assert.deepEqual(target.files.get('extras/credits.txt'), [
    ...strToU8('credits'),
  ]);
  assert.equal(target.directories.has('extras'), true);
  assert.equal(target.openWriterCount, 0);
});

test('CBZ extraction rejects truncated archives and closes output writers', async () => {
  const archive = zipSync({ '001.jpg': strToU8('page') });
  const target = new MemoryExtractionTarget();

  assert.deepEqual(
    await extractCbzChunks([archive.slice(0, archive.byteLength - 8)], target),
    { ok: false, error: { kind: 'invalid-archive' } },
  );
  assert.equal(target.openWriterCount, 0);
});

test('CBZ extraction rejects traversal and oversized entries', async (t) => {
  await t.test('parent traversal', async () => {
    const archive = zipSync({ '../outside.jpg': strToU8('page') });
    assert.deepEqual(
      await extractCbzChunks([archive], new MemoryExtractionTarget()),
      { ok: false, error: { kind: 'invalid-archive' } },
    );
  });

  await t.test('decompressed size limit', async () => {
    const archive = zipSync({ 'page.jpg': strToU8('too large') });
    assert.deepEqual(
      await extractCbzChunks([archive], new MemoryExtractionTarget(), {
        limits: {
          ...defaultLimits,
          maxEntryBytes: 4,
        },
      }),
      { ok: false, error: { kind: 'invalid-archive' } },
    );
  });
});

test('CBZ extraction distinguishes source reads from destination writes', async () => {
  const archive = zipSync({ 'page.jpg': strToU8('page') });
  const unreadable = {
    *[Symbol.iterator](): Iterator<Uint8Array> {
      throw new Error('source unavailable');
    },
  };

  assert.deepEqual(
    await extractCbzChunks(unreadable, new MemoryExtractionTarget()),
    { ok: false, error: { kind: 'source-read-failure' } },
  );
  assert.deepEqual(
    await extractCbzChunks([archive], new MemoryExtractionTarget(true)),
    { ok: false, error: { kind: 'write-failure' } },
  );
});

test('CBZ extraction closes its source iterator after an early write failure', async () => {
  const archive = zipSync({ 'page.jpg': new Uint8Array(128 * 1024) }, { level: 0 });
  let sourceClosed = false;
  const source = {
    *[Symbol.iterator](): Iterator<Uint8Array> {
      try {
        yield* chunk(archive, 1024);
      } finally {
        sourceClosed = true;
      }
    },
  };

  assert.deepEqual(
    await extractCbzChunks(source, new MemoryExtractionTarget(true)),
    { ok: false, error: { kind: 'write-failure' } },
  );
  assert.equal(sourceClosed, true);
});

test('CBZ central-directory validation survives circular tail-buffer wraps', async () => {
  const pageBytes = 256 * 1024;
  const archive = zipSync(
    { 'page.jpg': new Uint8Array(pageBytes) },
    { level: 0 },
  );

  assert.deepEqual(
    await extractCbzChunks(
      chunk(archive, 32 * 1024),
      new CountingExtractionTarget(),
    ),
    {
      ok: true,
      value: { fileCount: 1, totalBytes: pageBytes },
    },
  );
});

test('CBZ extraction streams 200+ images with bounded residency and event-loop yields', async () => {
  const imageCount = 205;
  const imageBytes = 64 * 1024;
  const image = new Uint8Array(imageBytes);
  const entries = Object.fromEntries(
    Array.from({ length: imageCount }, (_, index) => [
      `page-${String(index + 1).padStart(4, '0')}.jpg`,
      image,
    ]),
  );
  const archive = zipSync(entries, { level: 0 });
  const target = new CountingExtractionTarget();
  let yields = 0;

  const result = await extractCbzChunks(
    chunk(archive, 1024 * 1024),
    target,
    {
      limits: defaultLimits,
      scheduler: {
        yieldEveryBytes: 1024 * 1024,
        yieldControl: async () => {
          yields += 1;
        },
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    value: { fileCount: imageCount, totalBytes: imageCount * imageBytes },
  });
  assert.equal(target.maximumOpenWriters, 1);
  assert.equal(target.openWriterCount, 0);
  assert.ok(target.writeCount <= imageCount + Math.ceil(archive.byteLength / (1024 * 1024)));
  assert.ok(yields > 0);
});

class CountingExtractionTarget implements CbzExtractionTarget {
  public openWriterCount = 0;
  public maximumOpenWriters = 0;
  public writeCount = 0;

  public createDirectory(): void {}

  public createFile(): CbzExtractionFileWriter {
    this.openWriterCount += 1;
    this.maximumOpenWriters = Math.max(
      this.maximumOpenWriters,
      this.openWriterCount,
    );
    let closed = false;
    return {
      write: () => {
        this.writeCount += 1;
      },
      close: () => {
        if (!closed) {
          closed = true;
          this.openWriterCount -= 1;
        }
      },
    };
  }
}

function* chunk(bytes: Uint8Array, size: number): Iterable<Uint8Array> {
  for (let offset = 0; offset < bytes.byteLength; offset += size) {
    yield bytes.slice(offset, offset + size);
  }
}
