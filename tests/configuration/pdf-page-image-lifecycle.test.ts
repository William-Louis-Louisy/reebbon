/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const nativeModulePath = join(
  process.cwd(),
  'node_modules',
  '@dariyd',
  'react-native-pdf-page-image',
  'android',
  'src',
  'main',
  'java',
  'com',
  'pdfpageimage',
  'PdfPageImageModule.kt',
);

test('Android PDF cover resources are released on every lifecycle path', () => {
  const source = readFileSync(nativeModulePath, 'utf8');

  assert.match(source, /override fun invalidate\(\)/);
  assert.match(
    source,
    /override fun closePdf[\s\S]+pdfCache\.remove\(uri\)\?\.close\(\)[\s\S]+promise\.reject\("INTERNAL_ERROR"/,
  );
  assert.match(source, /catch \(error: Throwable\) \{\s+try \{\s+descriptor\.close\(\)/s);
  assert.match(source, /finally \{\s+bitmap\.recycle\(\)/s);
  assert.match(source, /finally \{\s+page\.close\(\)/s);
  assert.match(source, /renderer\.close\(\)[\s\S]+tempFiles\.clear\(\)/);
  assert.doesNotMatch(source, /fileDescriptor\.close\(\)/);
});
