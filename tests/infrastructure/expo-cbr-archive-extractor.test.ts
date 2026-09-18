/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { ReebbonCbrNativeModule } from '../../modules/reebbon-cbr';
import { ExpoCbrArchiveExtractor } from '../../src/infrastructure/importing/expo-cbr-archive-extractor';

const source = {
  kind: 'file',
  uri: 'content://picker/book.cbr',
  name: 'book.cbr',
} as const;

test('CBR adapter passes only the source URI and extraction ID to native code', async () => {
  const calls: unknown[][] = [];
  const native: ReebbonCbrNativeModule = {
    async extract(...arguments_) {
      calls.push(arguments_);
      return {
        directoryUri: 'file:///cache/reebbon-cbr/cbr-job/extracted',
        entryCount: 4,
        fileCount: 3,
        totalBytes: 128,
        solid: true,
      };
    },
    async cleanup(extractionId) {
      calls.push([extractionId]);
    },
  };
  const extractor = new ExpoCbrArchiveExtractor(native);

  assert.deepEqual(await extractor.extract(source, 'cbr-job'), {
    ok: true,
    value: {
      uri: 'file:///cache/reebbon-cbr/cbr-job/extracted',
      entryCount: 4,
      fileCount: 3,
      totalBytes: 128,
      solid: true,
    },
  });
  assert.deepEqual(await extractor.cleanup('cbr-job'), {
    ok: true,
    value: undefined,
  });
  assert.deepEqual(calls, [
    ['content://picker/book.cbr', 'cbr-job'],
    ['cbr-job'],
  ]);
});

test('CBR adapter validates native results and maps native exceptions', async () => {
  const invalid = new ExpoCbrArchiveExtractor({
    async extract() {
      return {
        directoryUri: 'content://unsafe',
        entryCount: 1,
        fileCount: 2,
        totalBytes: 0,
        solid: false,
      };
    },
    async cleanup() {},
  });
  assert.deepEqual(await invalid.extract(source, 'cbr-job'), {
    ok: false,
    error: { kind: 'filesystem-failure', operation: 'extract' },
  });

  const encrypted = new ExpoCbrArchiveExtractor({
    async extract() {
      throw { code: 'ERR_CBR_ENCRYPTED_ARCHIVE' };
    },
    async cleanup() {
      throw { code: 'ERR_CBR_CLEANUP' };
    },
  });
  assert.deepEqual(await encrypted.extract(source, 'cbr-job'), {
    ok: false,
    error: { kind: 'encrypted-archive' },
  });
  assert.deepEqual(await encrypted.cleanup('cbr-job'), {
    ok: false,
    error: { kind: 'filesystem-failure', operation: 'cleanup' },
  });
});
