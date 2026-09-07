/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { PDFDocument } from 'pdf-lib';

import type { ImportFileReader } from '../../src/application';
import { err, ok } from '../../src/domain';
import type { PdfFirstPageRenderer } from '../../src/infrastructure/importing/pdf-first-page-renderer';
import { PdfMetadataExtractor } from '../../src/infrastructure/importing/pdf-metadata-extractor';

const source = {
  kind: 'file',
  uri: 'content://picker/metadata.pdf',
  name: 'metadata.pdf',
} as const;
const cover = {
  mediaType: 'image/jpeg',
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
} as const;
const firstPage: PdfFirstPageRenderer = {
  render: async () => ok({ cover, totalPages: 3 }),
};

async function createPdfFixture(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.addPage([400, 600]);
  document.setTitle('The PDF Book');
  document.setAuthor('Ada Reader');
  return document.save();
}

test('PDF metadata extractor returns available document metadata and rendered cover', async () => {
  const bytes = await createPdfFixture();
  const files: Pick<ImportFileReader, 'readAll'> = {
    readAll: async () => ok(bytes),
  };

  assert.deepEqual(await new PdfMetadataExtractor(files, firstPage).extract(source), {
    ok: true,
    value: {
      title: 'The PDF Book',
      author: 'Ada Reader',
      cover,
      totalPages: 3,
    },
  });
});

test('unreadable optional metadata does not discard a natively validated PDF', async () => {
  const files: Pick<ImportFileReader, 'readAll'> = {
    readAll: async () => ok(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
  };

  assert.deepEqual(await new PdfMetadataExtractor(files, firstPage).extract(source), {
    ok: true,
    value: { cover, totalPages: 3 },
  });
});

test('an inaccessible PDF source returns its typed access error', async () => {
  const files: Pick<ImportFileReader, 'readAll'> = {
    readAll: async () => err({ kind: 'permission-or-access-failure' }),
  };

  assert.deepEqual(await new PdfMetadataExtractor(files, firstPage).extract(source), {
    ok: false,
    error: { kind: 'permission-or-access-failure', source },
  });
});
