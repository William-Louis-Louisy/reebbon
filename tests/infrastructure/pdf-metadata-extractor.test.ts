/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { err, ok } from '../../src/domain';
import type { PdfFirstPageRenderer } from '../../src/infrastructure/importing/pdf-first-page-renderer';
import { PdfMetadataExtractor } from '../../src/infrastructure/importing/pdf-metadata-extractor';

const source = {
  kind: 'file',
  uri: 'content://picker/large-scanned-document.pdf',
  name: 'large-scanned-document.pdf',
} as const;
const cover = {
  mediaType: 'image/jpeg',
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
} as const;

test('PDF metadata extraction only requests the bounded native first-page result', async () => {
  const renderedSources: string[] = [];
  const firstPage: PdfFirstPageRenderer = {
    render(requestedSource) {
      renderedSources.push(requestedSource.uri);
      return Promise.resolve(ok({ cover, totalPages: 448 }));
    },
  };

  assert.deepEqual(await new PdfMetadataExtractor(firstPage).extract(source), {
    ok: true,
    value: { cover, totalPages: 448 },
  });
  assert.deepEqual(renderedSources, [source.uri]);
});

test('PDF metadata extraction preserves typed native rendering failures', async () => {
  const firstPage: PdfFirstPageRenderer = {
    render: async () => err({ kind: 'corrupted-source', format: 'pdf' }),
  };

  assert.deepEqual(await new PdfMetadataExtractor(firstPage).extract(source), {
    ok: false,
    error: { kind: 'corrupted-source', format: 'pdf' },
  });
});
