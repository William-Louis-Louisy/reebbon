import {
  err,
  ok,
  type ReadingTheme,
  type Result,
} from '../../domain';

import type { Reader, ReaderError, ReaderProgress } from './reader';

export type ImageSetRenditionError = Extract<
  ReaderError,
  { readonly kind: 'content-access-failure' | 'rendering-failure' }
>;

export interface ImageSetRenditionLocation {
  readonly index: number;
  readonly totalPages: number;
}

export interface ImageSetRendition {
  open(
    contentUri: string,
    totalPages: number,
    initialIndex?: number,
  ): Promise<Result<void, ImageSetRenditionError>>;
  goTo(index: number): Promise<Result<void, ImageSetRenditionError>>;
  getLocation(): Promise<
    Result<ImageSetRenditionLocation, ImageSetRenditionError>
  >;
  close(): Promise<Result<void, ImageSetRenditionError>>;
}

export const imageSetReaderCapabilities = {
  tableOfContents: false,
  continuousScroll: false,
  readingThemeCustomization: false,
  fontCustomization: false,
  layoutCustomization: false,
  zoom: true,
  configurableReadingDirection: false,
  doublePage: false,
} as const;

type ReaderState = 'closed' | 'opening' | 'open' | 'failed';

export function createImageSetReader(
  rendition: ImageSetRendition,
): Reader<'images'> {
  let state: ReaderState = 'closed';
  let knownTotalPages: number | undefined;

  return {
    format: 'images',
    capabilities: imageSetReaderCapabilities,
    async open(book, initialPosition) {
      if (book.format !== 'images') {
        return err({
          kind: 'format-mismatch',
          expected: 'images',
          actual: book.format,
        });
      }
      const totalPages = normalizeTotalPages(book.totalPages);
      if (!isLocalContentUri(book.fileUri) || totalPages === undefined) {
        return err({ kind: 'content-access-failure' });
      }
      if (
        initialPosition !== undefined &&
        !isValidImageIndex(initialPosition.index, totalPages)
      ) {
        return err({ kind: 'invalid-position', position: initialPosition });
      }

      state = 'opening';
      knownTotalPages = totalPages;
      const opened = await callRendition(() =>
        rendition.open(book.fileUri, totalPages, initialPosition?.index),
      );
      state = opened.ok ? 'open' : 'failed';
      return opened;
    },
    async goTo(position) {
      if (state !== 'open') {
        return err({ kind: 'not-open' });
      }
      if (!isValidImageIndex(position.index, knownTotalPages)) {
        return err({ kind: 'invalid-position', position });
      }
      return callRendition(() => rendition.goTo(position.index));
    },
    async getProgress(): Promise<
      Result<ReaderProgress<'images'>, ReaderError>
    > {
      if (state !== 'open') {
        return err({ kind: 'not-open' });
      }

      const location = await callRendition(() => rendition.getLocation());
      if (
        !location.ok ||
        location.value.totalPages !== knownTotalPages ||
        !isValidImageIndex(
          location.value.index,
          location.value.totalPages,
        )
      ) {
        return location.ok ? err({ kind: 'rendering-failure' }) : location;
      }
      return ok({
        position: { kind: 'images', index: location.value.index },
        completionRatio: completionRatioForIndex(
          location.value.index,
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
      return closed;
    },
  };
}

function isLocalContentUri(uri: string): boolean {
  return uri.startsWith('file:///');
}

function isValidImageIndex(index: number, totalPages?: number): boolean {
  return (
    Number.isSafeInteger(index) &&
    index >= 0 &&
    totalPages !== undefined &&
    index < totalPages
  );
}

function normalizeTotalPages(value: number | undefined): number | undefined {
  return value !== undefined && Number.isSafeInteger(value) && value >= 1
    ? value
    : undefined;
}

function completionRatioForIndex(index: number, totalPages: number): number {
  return totalPages === 1 ? 1 : index / (totalPages - 1);
}

async function callRendition<T>(
  operation: () => Promise<Result<T, ImageSetRenditionError>>,
): Promise<Result<T, ImageSetRenditionError>> {
  try {
    return await operation();
  } catch {
    return err({ kind: 'rendering-failure' });
  }
}
