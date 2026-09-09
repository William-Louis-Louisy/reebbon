import type {
  ImageSetPage,
  ImageSetRenditionLocation,
} from '@/application';

const ADJACENT_PAGE_RADIUS = 1;

export const imagePagerVirtualization = {
  initialNumToRender: 3,
  maxToRenderPerBatch: 3,
  windowSize: 3,
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
): readonly number[] {
  if (!isValidIndex(currentIndex, totalPages)) {
    return [];
  }
  const first = Math.max(0, currentIndex - ADJACENT_PAGE_RADIUS);
  const last = Math.min(
    totalPages - 1,
    currentIndex + ADJACENT_PAGE_RADIUS,
  );
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
}

export function isImagePageResident(
  page: ImageSetPage,
  currentIndex: number,
  totalPages: number,
): boolean {
  return (
    isValidIndex(page.index, totalPages) &&
    Math.abs(page.index - currentIndex) <= ADJACENT_PAGE_RADIUS
  );
}

export function getImageIndexFromOffset(
  offset: number,
  viewportWidth: number,
  totalPages: number,
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
  const index = Math.round(offset / viewportWidth);
  return isValidIndex(index, totalPages) ? index : undefined;
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
