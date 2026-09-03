import { err, ok, type Result } from '../shared/result';

export const readerFontSizeRange = {
  minimum: 12,
  maximum: 24,
  default: 17,
  step: 1,
} as const;

declare const readerFontSizeBrand: unique symbol;

export type ReaderFontSize = number & {
  readonly [readerFontSizeBrand]: true;
};

export interface InvalidReaderFontSizeError {
  readonly kind: 'invalid-reader-font-size';
  readonly value: unknown;
}

export const defaultReaderFontSize =
  readerFontSizeRange.default as ReaderFontSize;

export function parseReaderFontSize(
  value: unknown,
): Result<ReaderFontSize, InvalidReaderFontSizeError> {
  return isReaderFontSize(value)
    ? ok(value as ReaderFontSize)
    : err({ kind: 'invalid-reader-font-size', value });
}

export function isReaderFontSize(value: unknown): value is ReaderFontSize {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= readerFontSizeRange.minimum &&
    value <= readerFontSizeRange.maximum
  );
}

export function stepReaderFontSize(
  value: ReaderFontSize,
  direction: 'decrease' | 'increase',
): ReaderFontSize {
  const offset =
    direction === 'decrease'
      ? -readerFontSizeRange.step
      : readerFontSizeRange.step;
  return Math.min(
    readerFontSizeRange.maximum,
    Math.max(readerFontSizeRange.minimum, value + offset),
  ) as ReaderFontSize;
}
