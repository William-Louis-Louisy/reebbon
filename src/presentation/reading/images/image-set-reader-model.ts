import type {
  ImageSetPage,
  ImageSetRenditionLocation,
} from '@/application';
import {
  defaultReadingDirection,
  type ReadingDirection,
} from '@/domain';
import { designSystemTokens } from '@/shared/theme';

const ADJACENT_SPREAD_RADIUS = 1;

export type ImagePagesPerSpread = 1 | 2;

export interface ImagePageSpread {
  readonly canonicalStartIndex: number;
  readonly pages: readonly ImageSetPage[];
}

export const imagePagePreloadConfiguration = {
  adjacentSpreadRadius: ADJACENT_SPREAD_RADIUS,
  maximumResidentSpreads: ADJACENT_SPREAD_RADIUS * 2 + 1,
  maximumPagesPerSpread: 2,
  maximumResidentPages: (ADJACENT_SPREAD_RADIUS * 2 + 1) * 2,
  cachePolicy: 'none',
  priority: 'high',
} as const;

export const imagePagerVirtualization = {
  initialNumToRender: imagePagePreloadConfiguration.maximumResidentSpreads,
  maxToRenderPerBatch: imagePagePreloadConfiguration.maximumResidentSpreads,
  scrollEventThrottle: 16,
  updateCellsBatchingPeriod: 16,
  windowSize: imagePagePreloadConfiguration.maximumResidentSpreads,
} as const;

export const imageZoomConfiguration = {
  minimumScale: 1,
  maximumScale: 4,
  resetThreshold: 1.01,
} as const;

export interface ImagePanBounds {
  readonly x: number;
  readonly y: number;
}

export function getImageFolio(
  location: ImageSetRenditionLocation | undefined,
): { readonly current: number; readonly total: number } | undefined {
  return location === undefined
    ? undefined
    : { current: location.index + 1, total: location.totalPages };
}

export function getResidentImageIndexes(
  currentIndex: number,
  totalPages: number,
  pagesPerSpread: ImagePagesPerSpread = 1,
): readonly number[] {
  if (!isValidIndex(currentIndex, totalPages)) {
    return [];
  }
  const currentSpread = Math.floor(currentIndex / pagesPerSpread);
  const totalSpreads = getImageSpreadCount(totalPages, pagesPerSpread);
  const firstSpread = Math.max(
    0,
    currentSpread - ADJACENT_SPREAD_RADIUS,
  );
  const lastSpread = Math.min(
    totalSpreads - 1,
    currentSpread + ADJACENT_SPREAD_RADIUS,
  );
  const first = firstSpread * pagesPerSpread;
  const last = Math.min(totalPages - 1, (lastSpread + 1) * pagesPerSpread - 1);
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
}

export function isImagePageResident(
  page: ImageSetPage,
  currentIndex: number,
  totalPages: number,
  pagesPerSpread: ImagePagesPerSpread = 1,
): boolean {
  return (
    isValidIndex(page.index, totalPages) &&
    isValidIndex(currentIndex, totalPages) &&
    Math.abs(
      Math.floor(page.index / pagesPerSpread) -
        Math.floor(currentIndex / pagesPerSpread),
    ) <= ADJACENT_SPREAD_RADIUS
  );
}

export function getImagePagesPerSpread(
  viewportWidth: number,
  viewportHeight: number,
  supportsDoublePage: boolean,
): ImagePagesPerSpread {
  const shortestSide = Math.min(viewportWidth, viewportHeight);
  return supportsDoublePage &&
    Number.isFinite(shortestSide) &&
    shortestSide >= designSystemTokens.layout.imageReader.tabletBreakpoint
    ? designSystemTokens.layout.imageReader.tabletPagesPerSpread
    : designSystemTokens.layout.imageReader.compactPagesPerSpread;
}

export function getImagePageSpreads(
  pages: readonly ImageSetPage[],
  pagesPerSpread: ImagePagesPerSpread,
  readingDirection: ReadingDirection,
): readonly ImagePageSpread[] {
  const spreads: ImagePageSpread[] = [];
  for (let start = 0; start < pages.length; start += pagesPerSpread) {
    const canonicalPages = pages.slice(start, start + pagesPerSpread);
    spreads.push({
      canonicalStartIndex: start,
      pages:
        readingDirection === 'right-to-left'
          ? [...canonicalPages].reverse()
          : canonicalPages,
    });
  }
  return readingDirection === 'right-to-left' ? spreads.reverse() : spreads;
}

export function getAdjacentImageLocationIndex(
  currentIndex: number,
  totalPages: number,
  pagesPerSpread: ImagePagesPerSpread,
  offset: -1 | 1,
): number | undefined {
  if (!isValidIndex(currentIndex, totalPages)) {
    return undefined;
  }
  const targetSpread = Math.floor(currentIndex / pagesPerSpread) + offset;
  return targetSpread >= 0 &&
    targetSpread < getImageSpreadCount(totalPages, pagesPerSpread)
    ? getImageSpreadLocationIndex(
        targetSpread,
        totalPages,
        pagesPerSpread,
      )
    : undefined;
}

export function getImageIndexFromOffset(
  offset: number,
  viewportWidth: number,
  totalPages: number,
  readingDirection: ReadingDirection = defaultReadingDirection,
  pagesPerSpread: ImagePagesPerSpread = 1,
): number | undefined {
  if (
    !Number.isFinite(offset) ||
    !Number.isFinite(viewportWidth) ||
    viewportWidth <= 0 ||
    !Number.isSafeInteger(totalPages) ||
    totalPages < 1
  ) {
    return undefined;
  }
  const pagerIndex = Math.round(offset / viewportWidth);
  const totalSpreads = getImageSpreadCount(totalPages, pagesPerSpread);
  return pagerIndex >= 0 && pagerIndex < totalSpreads
    ? getImagePageIndex(
        pagerIndex,
        totalPages,
        readingDirection,
        pagesPerSpread,
      )
    : undefined;
}

export function getImagePagerIndex(
  pageIndex: number,
  totalPages: number,
  readingDirection: ReadingDirection,
  pagesPerSpread: ImagePagesPerSpread = 1,
): number {
  const spreadIndex = Math.floor(pageIndex / pagesPerSpread);
  return readingDirection === 'right-to-left'
    ? getImageSpreadCount(totalPages, pagesPerSpread) - 1 - spreadIndex
    : spreadIndex;
}

export function getImagePageIndex(
  pagerIndex: number,
  totalPages: number,
  readingDirection: ReadingDirection,
  pagesPerSpread: ImagePagesPerSpread = 1,
): number {
  const totalSpreads = getImageSpreadCount(totalPages, pagesPerSpread);
  const spreadIndex =
    readingDirection === 'right-to-left'
      ? totalSpreads - 1 - pagerIndex
      : pagerIndex;
  return getImageSpreadLocationIndex(
    spreadIndex,
    totalPages,
    pagesPerSpread,
  );
}

export function getImagePanBounds(
  viewportWidth: number,
  viewportHeight: number,
  imageWidth: number,
  imageHeight: number,
  scale: number,
): ImagePanBounds {
  'worklet';
  if (
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    scale <= imageZoomConfiguration.minimumScale
  ) {
    return { x: 0, y: 0 };
  }

  const imageRatio = imageWidth / imageHeight;
  const viewportRatio = viewportWidth / viewportHeight;
  const containedWidth =
    imageRatio >= viewportRatio ? viewportWidth : viewportHeight * imageRatio;
  const containedHeight =
    imageRatio >= viewportRatio ? viewportWidth / imageRatio : viewportHeight;
  return {
    x: Math.max(0, (containedWidth * scale - viewportWidth) / 2),
    y: Math.max(0, (containedHeight * scale - viewportHeight) / 2),
  };
}

export function clampImageTranslation(value: number, bound: number): number {
  'worklet';
  return Math.min(Math.max(value, -bound), bound);
}

export function clampImageScale(value: number): number {
  'worklet';
  return Math.min(
    Math.max(value, imageZoomConfiguration.minimumScale),
    imageZoomConfiguration.maximumScale,
  );
}

function isValidIndex(index: number, totalPages: number): boolean {
  return (
    Number.isSafeInteger(index) &&
    Number.isSafeInteger(totalPages) &&
    index >= 0 &&
    totalPages >= 1 &&
    index < totalPages
  );
}

function getImageSpreadCount(
  totalPages: number,
  pagesPerSpread: ImagePagesPerSpread,
): number {
  return Math.ceil(totalPages / pagesPerSpread);
}

function getImageSpreadLocationIndex(
  spreadIndex: number,
  totalPages: number,
  pagesPerSpread: ImagePagesPerSpread,
): number {
  return Math.min((spreadIndex + 1) * pagesPerSpread - 1, totalPages - 1);
}
