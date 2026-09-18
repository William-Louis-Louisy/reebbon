/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const imageReaderRoot = resolve(
  process.cwd(),
  'src/presentation/reading/images',
);

test('image reader preloads only its bounded resident window', () => {
  const screenSource = readFileSync(
    resolve(imageReaderRoot, 'image-set-reader-screen.tsx'),
    'utf8',
  );
  const pageSource = readFileSync(
    resolve(imageReaderRoot, 'zoomable-image-page.tsx'),
    'utf8',
  );

  assert.match(screenSource, /onScroll={updatePreloadWindow}/);
  assert.match(screenSource, /extraData={residentCenterIndex}/);
  assert.match(
    screenSource,
    /isImagePageResident\(\s*item,\s*residentCenterIndex,\s*totalPages/,
  );
  assert.match(
    pageSource,
    /cachePolicy={imagePagePreloadConfiguration\.cachePolicy}/,
  );
  assert.match(
    pageSource,
    /priority={imagePagePreloadConfiguration\.priority}/,
  );
  assert.doesNotMatch(screenSource + pageSource, /Image\.prefetch\(/);
});
