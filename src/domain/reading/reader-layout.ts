export const readerLineSpacingOptions = [1.5, 1.7, 1.9] as const;
export type ReaderLineSpacing = (typeof readerLineSpacingOptions)[number];
export const defaultReaderLineSpacing: ReaderLineSpacing = 1.7;

export const readerHorizontalMarginOptions = [16, 24, 32] as const;
export type ReaderHorizontalMargin =
  (typeof readerHorizontalMarginOptions)[number];
export const defaultReaderHorizontalMargin: ReaderHorizontalMargin = 24;

export function isReaderLineSpacing(
  value: unknown,
): value is ReaderLineSpacing {
  return value === 1.5 || value === 1.7 || value === 1.9;
}

export function isReaderHorizontalMargin(
  value: unknown,
): value is ReaderHorizontalMargin {
  return value === 16 || value === 24 || value === 32;
}
