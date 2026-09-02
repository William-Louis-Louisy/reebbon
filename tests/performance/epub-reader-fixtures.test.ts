/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { unzipSync } from 'fflate';

import { extractEpubMetadata } from '../../src/infrastructure/importing/epub-metadata-extractor';
import {
  createLargeEpubFixture,
  createMalformedEpubFixture,
  largeEpubPageCount,
} from '../fixtures/epub-reader-fixtures';

test('large reader fixture contains more than 5000 ordered spine pages', () => {
  const archive = createLargeEpubFixture();
  const entries = unzipSync(archive);
  const pages = Object.keys(entries).filter((path) =>
    /^EPUB\/pages\/page-\d+\.xhtml$/.test(path),
  );

  assert.equal(largeEpubPageCount, 5_001);
  assert.equal(pages.length, largeEpubPageCount);
  assert.equal(entries['EPUB/pages/page-1.xhtml'] !== undefined, true);
  assert.equal(entries['EPUB/pages/page-5001.xhtml'] !== undefined, true);
  assert.deepEqual(extractEpubMetadata(archive), {
    ok: true,
    value: { title: 'Reebbon 5001 Page Fixture' },
  });
});

test('malformed reader fixture is rejected as a typed corrupted source', () => {
  assert.deepEqual(extractEpubMetadata(createMalformedEpubFixture()), {
    ok: false,
    error: { kind: 'corrupted-source', format: 'epub' },
  });
});
