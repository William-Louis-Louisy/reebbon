import { err, ok, type Result } from '../shared/result';

import type { BookFormat } from '../books/book';

export interface EpubReaderPosition {
  readonly kind: 'epub';
  readonly cfi: string;
}

export interface PdfReaderPosition {
  readonly kind: 'pdf';
  /** One-based page number. */
  readonly page: number;
}

export interface ImageReaderPosition {
  readonly kind: 'images';
  /** Zero-based index in the naturally sorted image sequence. */
  readonly index: number;
}

export type ReaderPosition = EpubReaderPosition | PdfReaderPosition | ImageReaderPosition;

export type ReaderPositionFor<F extends BookFormat> = Extract<ReaderPosition, { readonly kind: F }>;

export type InvalidReaderPositionReason =
  | 'missing-kind'
  | 'unsupported-kind'
  | 'invalid-epub-cfi'
  | 'invalid-pdf-page'
  | 'invalid-image-index';

export interface InvalidReaderPositionError {
  readonly kind: 'invalid-reader-position';
  readonly reason: InvalidReaderPositionReason;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseReaderPosition(value: unknown): Result<ReaderPosition, InvalidReaderPositionError> {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return err({ kind: 'invalid-reader-position', reason: 'missing-kind' });
  }

  switch (value.kind) {
    case 'epub':
      return typeof value.cfi === 'string' && value.cfi.trim().length > 0
        ? ok({ kind: 'epub', cfi: value.cfi })
        : err({ kind: 'invalid-reader-position', reason: 'invalid-epub-cfi' });
    case 'pdf':
      return typeof value.page === 'number' && Number.isInteger(value.page) && value.page >= 1
        ? ok({ kind: 'pdf', page: value.page })
        : err({ kind: 'invalid-reader-position', reason: 'invalid-pdf-page' });
    case 'images':
      return typeof value.index === 'number' && Number.isInteger(value.index) && value.index >= 0
        ? ok({ kind: 'images', index: value.index })
        : err({ kind: 'invalid-reader-position', reason: 'invalid-image-index' });
    default:
      return err({ kind: 'invalid-reader-position', reason: 'unsupported-kind' });
  }
}
