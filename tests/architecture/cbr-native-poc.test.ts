/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const pocRoot = resolve(process.cwd(), 'modules/reebbon-cbr-poc');

function read(relativePath: string): string {
  return readFileSync(resolve(pocRoot, relativePath), 'utf8');
}

test('the CBR POC uses one shared UnRAR core on Android and iOS', () => {
  const config = read('expo-module.config.json');
  const cmake = read('native/CMakeLists.txt');
  const podspec = read('ReebbonCbrPoc.podspec');

  assert.match(config, /"platforms": \["android", "apple"\]/);
  assert.match(config, /"podspecPath": "ReebbonCbrPoc\.podspec"/);
  assert.match(cmake, /unrar\/dll\.cpp/);
  assert.match(cmake, /reebbon_cbr_poc\.cpp/);
  assert.match(podspec, /native\/reebbon_cbr_poc\.\{hpp,cpp\}/);
  assert.match(podspec, /native\/unrar\/\#\{name\}\.cpp/);
});

test('the native boundary is disk-based, bounded, and rejects dangerous entries', () => {
  const core = read('native/reebbon_cbr_poc.cpp');
  const limits = read('native/reebbon_cbr_poc.hpp');
  const androidModule = read(
    'android/src/main/java/expo/modules/reebboncbrpoc/ReebbonCbrPocModule.kt',
  );
  const appleModule = read('ios/ReebbonCbrPocModule.swift');

  assert.match(core, /RAROpenArchiveEx/);
  assert.match(core, /RARProcessFileW/);
  assert.match(core, /header\.DictSize/);
  assert.match(core, /validateEntryLimits[\s\S]*RARProcessFileW/);
  assert.match(core, /UCM_PROCESSDATA/);
  assert.match(core, /header\.RedirType != 0U/);
  assert.match(core, /ERR_CBR_UNSAFE_PATH/);
  assert.match(core, /ERR_CBR_ENCRYPTED_ARCHIVE/);
  assert.match(core, /remove_all\(destination/);
  assert.match(limits, /64ULL \* 1024ULL \* 1024ULL/);
  assert.match(limits, /maxEntries = 10'000/);
  assert.match(androidModule, /context\.cacheDir, "reebbon-cbr-poc"/);
  assert.match(androidModule, /ERR_CBR_UNSAFE_CLEANUP/);
  assert.match(appleModule, /temporaryDirectory\.appendingPathComponent/);
  assert.match(appleModule, /ERR_CBR_UNSAFE_CLEANUP/);
  assert.doesNotMatch(core, /ArrayBuffer|Uint8Array|readAll|readBytes/);
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

test('the POC does not enable CBR in the product import flow', () => {
  const importFormat = readFileSync(
    resolve(process.cwd(), 'src/application/importing/importer.ts'),
    'utf8',
  );
  const imagePipeline = readFileSync(
    resolve(process.cwd(), 'src/application/importing/import-image-directory.ts'),
    'utf8',
  );

  assert.doesNotMatch(importFormat, /['"]cbr['"]/);
  assert.match(imagePipeline, /export interface ImageDirectoryImportPipeline/);
});
