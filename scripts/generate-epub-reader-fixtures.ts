/// <reference types="node" />

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  createLargeEpubFixture,
  createMalformedEpubFixture,
} from '../tests/fixtures/epub-reader-fixtures';

const outputDirectory = resolve('.expo', 'reader-fixtures');

async function main(): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, 'large-5001.epub'), createLargeEpubFixture()),
    writeFile(resolve(outputDirectory, 'malformed.epub'), createMalformedEpubFixture()),
  ]);

  console.log(`EPUB reader fixtures generated in ${outputDirectory}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
