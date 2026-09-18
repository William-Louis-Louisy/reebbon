/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampImageScale,
  clampImageTranslation,
  getImageFolio,
  getImageIndexFromOffset,
  getImagePagerIndex,
  getImagePagesInReadingOrder,
  getImagePanBounds,
  getResidentImageIndexes,
  imagePagePreloadConfiguration,
  imagePagerVirtualization,
  isImagePageResident,
} from '../../src/presentation/reading/images/image-set-reader-model';

test('image residency mounts only the active page and adjacent preload window', () => {
  const totalPages = 205;
  assert.deepEqual(getResidentImageIndexes(100, totalPages), [99, 100, 101]);
  assert.equal(
    Array.from({ length: totalPages }, (_, index) => ({
      index,
      uri: `file:///book/page-${index}.jpg`,
    })).filter((page) => isImagePageResident(page, 100, totalPages)).length,
    3,
  );
  assert.deepEqual(imagePagePreloadConfiguration, {
    adjacentPageRadius: 1,
    maximumResidentPages: 3,
    cachePolicy: 'none',
    priority: 'high',
  });
  assert.deepEqual(imagePagerVirtualization, {
    initialNumToRender: 3,
    maxToRenderPerBatch: 3,
    scrollEventThrottle: 16,
    updateCellsBatchingPeriod: 16,
    windowSize: 3,
  });
});

test('image residency stays bounded across a 200+ page book', () => {
  const totalPages = 205;

  for (let currentIndex = 0; currentIndex < totalPages; currentIndex += 1) {
    const residentIndexes = getResidentImageIndexes(
      currentIndex,
      totalPages,
    );
    assert.ok(
      residentIndexes.length <=
        imagePagePreloadConfiguration.maximumResidentPages,
    );
    assert.ok(residentIndexes.includes(currentIndex));
    assert.ok(
      residentIndexes.every(
        (index) => Math.abs(index - currentIndex) <= 1,
      ),
    );
  }
});

test('image residency clamps its preload window at book boundaries', () => {
  assert.deepEqual(getResidentImageIndexes(0, 205), [0, 1]);
  assert.deepEqual(getResidentImageIndexes(204, 205), [203, 204]);
  assert.deepEqual(getResidentImageIndexes(0, 1), [0]);
  assert.deepEqual(getResidentImageIndexes(-1, 205), []);
  assert.deepEqual(getResidentImageIndexes(205, 205), []);
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

test('right-to-left paging reverses visual order while preserving canonical indexes', () => {
  const pages = Array.from({ length: 5 }, (_, index) => ({
    index,
    uri: `file:///book/page-${index}.jpg`,
  }));

  assert.deepEqual(
    getImagePagesInReadingOrder(pages, 'right-to-left').map(
      (page) => page.index,
    ),
    [4, 3, 2, 1, 0],
  );
  assert.equal(getImagePagerIndex(1, 5, 'right-to-left'), 3);
  assert.equal(
    getImageIndexFromOffset(3 * 390, 390, 5, 'right-to-left'),
    1,
  );
  assert.equal(getImagePagerIndex(1, 5, 'left-to-right'), 1);
  assert.equal(getImageIndexFromOffset(390, 390, 5, 'left-to-right'), 1);
});

test('adjacent preload follows the visual target in both reading directions', () => {
  const pages = Array.from({ length: 7 }, (_, index) => ({
    index,
    uri: `file:///book/page-${index}.jpg`,
  }));
  const previousIndex = 2;
  const targetIndex = 3;
  const viewportWidth = 390;

  for (const direction of ['left-to-right', 'right-to-left'] as const) {
    const targetPagerIndex = getImagePagerIndex(
      targetIndex,
      pages.length,
      direction,
    );
    const preloadCenter = getImageIndexFromOffset(
      targetPagerIndex * viewportWidth,
      viewportWidth,
      pages.length,
      direction,
    );
    assert.equal(preloadCenter, targetIndex);
    if (preloadCenter === undefined) {
      continue;
    }

    const residentIndexes = getResidentImageIndexes(
      preloadCenter,
      pages.length,
    );
    assert.deepEqual(residentIndexes, [2, 3, 4]);
    assert.ok(residentIndexes.includes(previousIndex));
    assert.deepEqual(
      getImagePagesInReadingOrder(pages, direction)
        .filter((page) => residentIndexes.includes(page.index))
        .map((page) => page.index),
      direction === 'left-to-right' ? [2, 3, 4] : [4, 3, 2],
    );
  }
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
