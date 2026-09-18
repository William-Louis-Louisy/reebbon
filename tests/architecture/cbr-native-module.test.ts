/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const moduleRoot = resolve(process.cwd(), 'modules/reebbon-cbr');

function read(relativePath: string): string {
  return readFileSync(resolve(moduleRoot, relativePath), 'utf8');
}

test('CBR uses one shared official UnRAR core on Android and iOS', () => {
  const config = read('expo-module.config.json');
  const cmake = read('native/CMakeLists.txt');
  const podspec = read('ReebbonCbr.podspec');

  assert.match(config, /"platforms": \["android", "apple"\]/);
  assert.match(config, /"podspecPath": "ReebbonCbr\.podspec"/);
  assert.match(cmake, /unrar\/dll\.cpp/);
  assert.match(cmake, /reebbon_cbr\.cpp/);
  assert.match(podspec, /native\/reebbon_cbr\.\{hpp,cpp\}/);
  assert.match(podspec, /native\/unrar\/#\{name\}\.cpp/);
});

test('the native boundary streams a local source copy to bounded disk extraction', () => {
  const core = read('native/reebbon_cbr.cpp');
  const limits = read('native/reebbon_cbr.hpp');
  const androidModule = read(
    'android/src/main/java/expo/modules/reebboncbr/ReebbonCbrModule.kt',
  );
  const appleModule = read('ios/ReebbonCbrModule.swift');
  const typescriptModule = read('index.ts');

  assert.match(core, /RAROpenArchiveEx/);
  assert.match(core, /RARProcessFileW/);
  assert.match(
    core,
    /RARProcessFileW\(\s*archive\.get\(\), RAR_EXTRACT, destinationWide\.data\(\), nullptr\)/,
  );
  assert.doesNotMatch(core, /RARProcessFileW\([^;]*normalizedName\.data\(\)/s);
  assert.match(core, /header\.DictSize/);
  assert.match(core, /validateEntryLimits[\s\S]*RARProcessFileW/);
  assert.match(core, /UCM_PROCESSDATA/);
  assert.match(core, /header\.RedirType != 0U/);
  assert.match(core, /ERR_CBR_UNSAFE_PATH/);
  assert.match(core, /ERR_CBR_ENCRYPTED_ARCHIVE/);
  assert.match(core, /remove_all\(destination/);
  assert.match(limits, /maxArchiveBytes = 2ULL \* 1024ULL \* 1024ULL \* 1024ULL/);
  assert.match(limits, /64ULL \* 1024ULL \* 1024ULL/);
  assert.match(limits, /maxEntries = 10'000/);
  assert.match(androidModule, /contentResolver\.openInputStream/);
  assert.match(androidModule, /ByteArray\(SOURCE_COPY_BUFFER_BYTES\)/);
  assert.match(androidModule, /maxArchiveBytesNative/);
  assert.match(androidModule, /TEMPORARY_ROOT = "reebbon-cbr"/);
  assert.match(appleModule, /copyItem\(at: source, to: destination\)/);
  assert.match(appleModule, /maximumArchiveBytes/);
  assert.match(typescriptModule, /extract\(sourceUri: string, extractionId: string\)/);
  assert.doesNotMatch(typescriptModule, /Uint8Array|ArrayBuffer|readAll|base64/);
});

test('Android resolves lutimes through the upstream POSIX feature path', () => {
  const cmake = read('native/CMakeLists.txt');
  const upstreamOs = read('native/unrar/os.hpp');
  const upstreamLinks = read('native/unrar/ulinks.cpp');

  assert.match(cmake, /_POSIX_C_SOURCE=200809L/);
  assert.doesNotMatch(cmake, /^\s*RAR_SMP\s*$/m);
  assert.match(upstreamOs, /_POSIX_C_SOURCE >= 200809L/);
  assert.match(upstreamLinks, /utimensat\(AT_FDCWD/);
  assert.doesNotMatch(cmake, /lutimes=utimes/);
});

test('CBR product import delegates to the common Images pipeline', () => {
  const importer = readFileSync(
    resolve(process.cwd(), 'src/application/importing/import-cbr.ts'),
    'utf8',
  );
  const imagePipeline = readFileSync(
    resolve(process.cwd(), 'src/application/importing/import-image-directory.ts'),
    'utf8',
  );

  assert.match(importer, /dependencies\.images\.importDirectory/);
  assert.match(importer, /format: 'cbr'/);
  assert.match(imagePipeline, /'image-directory' \| 'cbz' \| 'cbr'/);
  assert.doesNotMatch(importer, /stageFile|coverUri|compareNaturalFileNames/);
});
