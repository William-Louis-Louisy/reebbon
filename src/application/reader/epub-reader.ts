import {
  err,
  isReaderHorizontalMargin,
  isReaderLineSpacing,
  isReaderFontSize,
  isValidEpubCfi,
  ok,
  type ReadingTheme,
  type ReaderFontSize,
  type ReaderHorizontalMargin,
  type ReaderLineSpacing,
  type Result,
} from '../../domain';

import type {
  Reader,
  ReaderError,
  ReaderProgress,
  ReaderTableOfContents,
  ReaderTableOfContentsEntry,
} from './reader';

export type EpubRenditionError = Extract<
  ReaderError,
  { readonly kind: 'content-access-failure' | 'rendering-failure' }
>;

export interface EpubRenditionLocation {
  readonly cfi: string;
  readonly completionRatio: number;
}

export interface EpubRendition {
  open(
    fileUri: string,
    initialCfi?: string,
  ): Promise<Result<void, EpubRenditionError>>;
  goTo(cfi: string): Promise<Result<void, EpubRenditionError>>;
  getTableOfContents(): Promise<
    Result<readonly ReaderTableOfContentsEntry[], EpubRenditionError>
  >;
  goToTableOfContentsEntry(
    entryId: string,
  ): Promise<Result<void, EpubRenditionError>>;
  getLocation(): Promise<Result<EpubRenditionLocation, EpubRenditionError>>;
  setTheme(theme: ReadingTheme): Promise<Result<void, EpubRenditionError>>;
  setFontSize(
    fontSize: ReaderFontSize,
  ): Promise<Result<void, EpubRenditionError>>;
  setHorizontalMargin(
    margin: ReaderHorizontalMargin,
  ): Promise<Result<void, EpubRenditionError>>;
  setLineSpacing(
    lineSpacing: ReaderLineSpacing,
  ): Promise<Result<void, EpubRenditionError>>;
  close(): Promise<Result<void, EpubRenditionError>>;
}

export const epubReaderCapabilities = {
  tableOfContents: true,
  continuousScroll: true,
  fontCustomization: true,
  layoutCustomization: true,
  zoom: false,
  configurableReadingDirection: false,
  doublePage: false,
} as const;

type ReaderState = 'closed' | 'opening' | 'open' | 'failed';

export function createEpubReader(rendition: EpubRendition): Reader<'epub'> {
  let state: ReaderState = 'closed';
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
        return err({
          kind: 'invalid-table-of-contents-entry',
          entryId,
        });
      }
      return callRendition(() =>
        rendition.goToTableOfContentsEntry(entryId),
      );
    },
  };

  return {
    format: 'epub',
    capabilities: epubReaderCapabilities,
    fontCustomization: {
      async setFontSize(fontSize) {
        if (state !== 'open') {
          return err({ kind: 'not-open' });
        }
        if (!isReaderFontSize(fontSize)) {
          return err({ kind: 'invalid-font-size', fontSize });
        }
        return callRendition(() => rendition.setFontSize(fontSize));
      },
    },
    layoutCustomization: {
      async setHorizontalMargin(margin) {
        if (state !== 'open') {
          return err({ kind: 'not-open' });
        }
        if (!isReaderHorizontalMargin(margin)) {
          return err({ kind: 'invalid-horizontal-margin', margin });
        }
        return callRendition(() => rendition.setHorizontalMargin(margin));
      },
      async setLineSpacing(lineSpacing) {
        if (state !== 'open') {
          return err({ kind: 'not-open' });
        }
        if (!isReaderLineSpacing(lineSpacing)) {
          return err({ kind: 'invalid-line-spacing', lineSpacing });
        }
        return callRendition(() => rendition.setLineSpacing(lineSpacing));
      },
    },
    tableOfContents,
    async open(book, initialPosition) {
      if (book.format !== 'epub') {
        return err({
          kind: 'format-mismatch',
          expected: 'epub',
          actual: book.format,
        });
      }
      if (!isLocalEpubUri(book.fileUri)) {
        return err({ kind: 'content-access-failure' });
      }
      if (
        initialPosition !== undefined &&
        !isValidEpubCfi(initialPosition.cfi)
      ) {
        return err({ kind: 'invalid-position', position: initialPosition });
      }

      tableOfContentsEntries = [];
      state = 'opening';
      const opened = await callRendition(() =>
        rendition.open(book.fileUri, initialPosition?.cfi),
      );
      state = opened.ok ? 'open' : 'failed';
      return opened;
    },
    async goTo(position) {
      if (state !== 'open') {
        return err({ kind: 'not-open' });
      }
      if (!isValidEpubCfi(position.cfi)) {
        return err({ kind: 'invalid-position', position });
      }
      return callRendition(() => rendition.goTo(position.cfi));
    },
    async getProgress(): Promise<Result<ReaderProgress<'epub'>, ReaderError>> {
      if (state !== 'open') {
        return err({ kind: 'not-open' });
      }

      const location = await callRendition(() => rendition.getLocation());
      return location.ok
        ? ok({
            position: { kind: 'epub', cfi: location.value.cfi },
            completionRatio: normalizeCompletionRatio(
              location.value.completionRatio,
            ),
          })
        : location;
    },
    async setTheme(theme) {
      return state === 'open'
        ? callRendition(() => rendition.setTheme(theme))
        : err({ kind: 'not-open' });
    },
    async close() {
      if (state === 'closed') {
        return ok(undefined);
      }
      const closed = await callRendition(() => rendition.close());
      state = 'closed';
      tableOfContentsEntries = [];
      return closed;
    },
  };
}

function isLocalEpubUri(uri: string): boolean {
  return uri.startsWith('file:///') && /\.epub$/i.test(uri);
}

function normalizeCompletionRatio(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

async function callRendition<T>(
  operation: () => Promise<Result<T, EpubRenditionError>>,
): Promise<Result<T, EpubRenditionError>> {
  try {
    return await operation();
  } catch {
    return err({ kind: 'rendering-failure' });
  }
}
