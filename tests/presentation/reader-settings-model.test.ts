/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { ReaderCapabilities } from '../../src/domain';
import { getReaderSettingsSections } from '../../src/presentation/reading/reader-settings-model';

const baseCapabilities: ReaderCapabilities = {
  tableOfContents: false,
  continuousScroll: false,
  readingThemeCustomization: false,
  fontCustomization: false,
  layoutCustomization: false,
  zoom: false,
  configurableReadingDirection: false,
  doublePage: false,
};

test('reader settings hide controls when the active reader lacks their capabilities', () => {
  assert.deepEqual(getReaderSettingsSections(baseCapabilities), []);
});

test('reader settings expose personalization controls from active capabilities', () => {
  assert.deepEqual(
    getReaderSettingsSections({
      ...baseCapabilities,
      readingThemeCustomization: true,
    }),
    ['reading-theme'],
  );
  assert.deepEqual(
    getReaderSettingsSections({
      ...baseCapabilities,
      fontCustomization: true,
    }),
    ['font-customization'],
  );
  assert.deepEqual(
    getReaderSettingsSections({
      ...baseCapabilities,
      layoutCustomization: true,
    }),
    ['layout-customization'],
  );
  assert.deepEqual(
    getReaderSettingsSections({
      ...baseCapabilities,
      readingThemeCustomization: true,
      fontCustomization: true,
      layoutCustomization: true,
    }),
    [
      'reading-theme',
      'font-customization',
      'layout-customization',
    ],
  );
});

test('unimplemented reader capabilities do not invent settings controls', () => {
  assert.deepEqual(
    getReaderSettingsSections({
      ...baseCapabilities,
      continuousScroll: true,
      zoom: true,
      configurableReadingDirection: true,
      doublePage: true,
    }),
    [],
  );
});
