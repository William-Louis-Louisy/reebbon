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

test('CBZ stream extraction writes root and nested files from bounded chunks', () => {
  const archive = zipSync({
    'page_10.jpg': strToU8('ten'),
    'page_2.png': strToU8('two'),
    'extras/credits.txt': strToU8('credits'),
  });
  const target = new MemoryExtractionTarget();

  const result = extractCbzChunks(chunk(archive, 7), target);

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

test('CBZ extraction rejects truncated archives and closes output writers', () => {
  const archive = zipSync({ '001.jpg': strToU8('page') });
  const target = new MemoryExtractionTarget();

  assert.deepEqual(
    extractCbzChunks([archive.slice(0, archive.byteLength - 8)], target),
    { ok: false, error: { kind: 'invalid-archive' } },
  );
  assert.equal(target.openWriterCount, 0);
});

test('CBZ extraction rejects traversal and oversized entries', async (t) => {
  await t.test('parent traversal', () => {
    const archive = zipSync({ '../outside.jpg': strToU8('page') });
    assert.deepEqual(
      extractCbzChunks([archive], new MemoryExtractionTarget()),
      { ok: false, error: { kind: 'invalid-archive' } },
    );
  });

  await t.test('decompressed size limit', () => {
    const archive = zipSync({ 'page.jpg': strToU8('too large') });
    assert.deepEqual(
      extractCbzChunks([archive], new MemoryExtractionTarget(), {
        ...defaultLimits,
        maxEntryBytes: 4,
      }),
      { ok: false, error: { kind: 'invalid-archive' } },
    );
  });
});

test('CBZ extraction distinguishes source reads from destination writes', () => {
  const archive = zipSync({ 'page.jpg': strToU8('page') });
  const unreadable = {
    *[Symbol.iterator](): Iterator<Uint8Array> {
      throw new Error('source unavailable');
    },
  };

  assert.deepEqual(
    extractCbzChunks(unreadable, new MemoryExtractionTarget()),
    { ok: false, error: { kind: 'source-read-failure' } },
  );
  assert.deepEqual(
    extractCbzChunks([archive], new MemoryExtractionTarget(true)),
    { ok: false, error: { kind: 'write-failure' } },
  );
});

function* chunk(bytes: Uint8Array, size: number): Iterable<Uint8Array> {
  for (let offset = 0; offset < bytes.byteLength; offset += size) {
    yield bytes.slice(offset, offset + size);
  }
}
