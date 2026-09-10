/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const moduleRoot = resolve(
  process.cwd(),
  'modules/reebbon-import/android/src/main/java/expo/modules/reebbonimport',
);

test('Android CBZ extraction stays native, off the UI thread, and buffer-bounded', () => {
  const moduleSource = readFileSync(
    resolve(moduleRoot, 'ReebbonImportModule.kt'),
    'utf8',
  );
  const extractorSource = readFileSync(
    resolve(moduleRoot, 'NativeCbzExtractor.kt'),
    'utf8',
  );
  const centralDirectorySource = readFileSync(
    resolve(moduleRoot, 'ZipCentralDirectoryValidator.kt'),
    'utf8',
  );

  assert.match(moduleSource, /AsyncFunction\("extractCbz"\) Coroutine/);
  assert.match(moduleSource, /withContext\(Dispatchers\.IO\)/);
  assert.match(extractorSource, /ZipInputStream/);
  assert.match(extractorSource, /ByteArray\(CBZ_BUFFER_BYTES\)/);
  assert.match(centralDirectorySource, /ZIP_END_RECORD_MAX_BYTES = 65_535 \+ 22/);
  assert.doesNotMatch(moduleSource + extractorSource, /fflate|readBytes|writeBytes/);
});
