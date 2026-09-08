import {
  err,
  ok,
  type ReadingTheme,
  type Result,
} from '../../domain';

import type {
  Reader,
  ReaderError,
  ReaderProgress,
  ReaderTableOfContents,
  ReaderTableOfContentsEntry,
} from './reader';

export type PdfRenditionError = Extract<
  ReaderError,
  { readonly kind: 'content-access-failure' | 'rendering-failure' }
>;

export interface PdfRenditionLocation {
  readonly page: number;
  readonly totalPages: number;
}

export interface PdfRenditionTableOfContentsEntry
  extends ReaderTableOfContentsEntry {
  readonly page: number;
}

export interface PdfRendition {
  open(
    fileUri: string,
    initialPage?: number,
  ): Promise<Result<void, PdfRenditionError>>;
  goTo(page: number): Promise<Result<void, PdfRenditionError>>;
  getTableOfContents(): Promise<
    Result<readonly ReaderTableOfContentsEntry[], PdfRenditionError>
  >;
  goToTableOfContentsEntry(
    entryId: string,
  ): Promise<Result<void, PdfRenditionError>>;
  getLocation(): Promise<Result<PdfRenditionLocation, PdfRenditionError>>;
  close(): Promise<Result<void, PdfRenditionError>>;
}

export const pdfReaderCapabilities = {
  tableOfContents: true,
  continuousScroll: false,
  readingThemeCustomization: false,
  fontCustomization: false,
  layoutCustomization: false,
  zoom: true,
  configurableReadingDirection: false,
  doublePage: false,
} as const;

type ReaderState = 'closed' | 'opening' | 'open' | 'failed';

export function createPdfReader(rendition: PdfRendition): Reader<'pdf'> {
  let state: ReaderState = 'closed';
  let knownTotalPages: number | undefined;
  let tableOfContentsEntries: readonly ReaderTableOfContentsEntry[] = [];
  const tableOfContents: ReaderTableOfContents = {
    async getEntries() {
      if (state !== 'open') {
        return err({ kind: 'not-open' });
      }
      const entries = await callRendition(() => rendition.getTableOfContents());
      if (entries.ok) {
        tableOfContentsEntries = entries.value;
      }
      return entries;
    },
    async goToEntry(entryId) {
      if (state !== 'open') {
        return err({ kind: 'not-open' });
      }
      if (!tableOfContentsEntries.some((entry) => entry.id === entryId)) {
        return err({ kind: 'invalid-table-of-contents-entry', entryId });
      }
      return callRendition(() =>
        rendition.goToTableOfContentsEntry(entryId),
      );
    },
  };

  return {
    format: 'pdf',
    capabilities: pdfReaderCapabilities,
    tableOfContents,
    async open(book, initialPosition) {
      if (book.format !== 'pdf') {
        return err({
          kind: 'format-mismatch',
          expected: 'pdf',
          actual: book.format,
        });
      }
      if (!isLocalPdfUri(book.fileUri)) {
        return err({ kind: 'content-access-failure' });
      }
      if (
        initialPosition !== undefined &&
        !isValidPdfPage(initialPosition.page, book.totalPages)
      ) {
        return err({ kind: 'invalid-position', position: initialPosition });
      }

      tableOfContentsEntries = [];
      state = 'opening';
      knownTotalPages = normalizeTotalPages(book.totalPages);
      const opened = await callRendition(() =>
        rendition.open(book.fileUri, initialPosition?.page),
      );
      state = opened.ok ? 'open' : 'failed';
      return opened;
    },
    async goTo(position) {
      if (state !== 'open') {
        return err({ kind: 'not-open' });
      }
      if (!isValidPdfPage(position.page, knownTotalPages)) {
        return err({ kind: 'invalid-position', position });
      }
      return callRendition(() => rendition.goTo(position.page));
    },
    async getProgress(): Promise<Result<ReaderProgress<'pdf'>, ReaderError>> {
      if (state !== 'open') {
        return err({ kind: 'not-open' });
      }

      const location = await callRendition(() => rendition.getLocation());
      if (!location.ok) {
        return location;
      }
      if (
        !isValidPdfPage(location.value.page, location.value.totalPages) ||
        normalizeTotalPages(location.value.totalPages) === undefined
      ) {
        return err({ kind: 'rendering-failure' });
      }
      knownTotalPages = location.value.totalPages;
      return ok({
        position: { kind: 'pdf', page: location.value.page },
        completionRatio: completionRatioForPage(
          location.value.page,
          location.value.totalPages,
        ),
      });
    },
    async setTheme(_theme: ReadingTheme) {
      return state === 'open' ? ok(undefined) : err({ kind: 'not-open' });
    },
    async close() {
      if (state === 'closed') {
        return ok(undefined);
      }
      const closed = await callRendition(() => rendition.close());
      state = 'closed';
      knownTotalPages = undefined;
      tableOfContentsEntries = [];
      return closed;
    },
  };
}

function isLocalPdfUri(uri: string): boolean {
  return uri.startsWith('file:///') && /\.pdf$/i.test(uri);
}

function isValidPdfPage(page: number, totalPages?: number): boolean {
  return (
    Number.isSafeInteger(page) &&
    page >= 1 &&
    (totalPages === undefined || page <= totalPages)
  );
}

function normalizeTotalPages(value: number | undefined): number | undefined {
  return value !== undefined && Number.isSafeInteger(value) && value >= 1
    ? value
    : undefined;
}

function completionRatioForPage(page: number, totalPages: number): number {
  return totalPages === 1 ? 1 : (page - 1) / (totalPages - 1);
}

async function callRendition<T>(
  operation: () => Promise<Result<T, PdfRenditionError>>,
): Promise<Result<T, PdfRenditionError>> {
  try {
    return await operation();
  } catch {
    return err({ kind: 'rendering-failure' });
  }
}
