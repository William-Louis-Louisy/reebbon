import type { PdfRenditionLocation } from '@/application';
import { err, ok, type Result } from '@/domain';

export interface InvalidPdfLocationError {
  readonly kind: 'invalid-pdf-location';
}

export function parsePdfLocation(
  page: unknown,
  totalPages: unknown,
): Result<PdfRenditionLocation, InvalidPdfLocationError> {
  return Number.isSafeInteger(page) &&
    typeof page === 'number' &&
    page >= 1 &&
    Number.isSafeInteger(totalPages) &&
    typeof totalPages === 'number' &&
    totalPages >= 1 &&
    page <= totalPages
    ? ok({ page, totalPages })
    : err({ kind: 'invalid-pdf-location' });
}

export function getPdfFolio(
  location: PdfRenditionLocation | undefined,
): { readonly current: number; readonly total: number } | undefined {
  return location === undefined
    ? undefined
    : { current: location.page, total: location.totalPages };
}
