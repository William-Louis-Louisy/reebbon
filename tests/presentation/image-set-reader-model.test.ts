/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampImageScale,
  clampImageTranslation,
  getImageFolio,
  getImageIndexFromOffset,
  getImagePanBounds,
  getResidentImageIndexes,
  imagePagerVirtualization,
  isImagePageResident,
} from '../../src/presentation/reading/images/image-set-reader-model';

test('image residency mounts only the active page and adjacent preload window', () => {
  const totalPages = 205;
  assert.deepEqual(getResidentImageIndexes(100, totalPages), [99, 100, 101]);
  assert.deepEqual(getResidentImageIndexes(0, totalPages), [0, 1]);
  assert.deepEqual(getResidentImageIndexes(204, totalPages), [203, 204]);
  assert.equal(
    Array.from({ length: totalPages }, (_, index) => ({
      index,
      uri: `file:///book/page-${index}.jpg`,
    })).filter((page) => isImagePageResident(page, 100, totalPages)).length,
    3,
  );
  assert.deepEqual(imagePagerVirtualization, {
    initialNumToRender: 3,
    maxToRenderPerBatch: 3,
    windowSize: 3,
  });
});

test('image pager derives bounded zero-based indexes and one-based folios', () => {
  assert.equal(getImageIndexFromOffset(780, 390, 5), 2);
  assert.equal(getImageIndexFromOffset(-390, 390, 5), undefined);
  assert.equal(getImageIndexFromOffset(390, 0, 5), undefined);
  assert.equal(getImageIndexFromOffset(1950, 390, 5), undefined);
  assert.deepEqual(getImageFolio({ index: 2, totalPages: 5 }), {
    current: 3,
    total: 5,
  });
  assert.equal(getImageFolio(undefined), undefined);
});

test('zoom and pan remain bounded around the contained high-resolution image', () => {
  assert.equal(clampImageScale(0.5), 1);
  assert.equal(clampImageScale(8), 4);
  assert.equal(clampImageScale(2.5), 2.5);
  assert.deepEqual(getImagePanBounds(400, 800, 2000, 1000, 2), {
    x: 200,
    y: 0,
  });
  assert.deepEqual(getImagePanBounds(400, 800, 1000, 2000, 2), {
    x: 200,
    y: 400,
  });
  assert.deepEqual(getImagePanBounds(400, 800, 1000, 2000, 1), {
    x: 0,
    y: 0,
  });
  assert.equal(clampImageTranslation(300, 200), 200);
  assert.equal(clampImageTranslation(-300, 200), -200);
});
