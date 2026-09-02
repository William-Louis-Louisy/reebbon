import type { Result } from '../../domain';

import type { FileImportSource, ImportError, ImportFormat } from './importer';

const MAX_BOOK_METADATA_TEXT_LENGTH = 500;

export type ExtractedCoverMediaType =
  | 'image/gif'
  | 'image/jpeg'
  | 'image/png'
  | 'image/svg+xml'
  | 'image/webp';

export interface ExtractedBookCover {
  readonly bytes: Uint8Array;
  readonly mediaType: ExtractedCoverMediaType;
}

export interface ExtractedBookMetadata {
  readonly title?: string;
  readonly author?: string;
  readonly cover?: ExtractedBookCover;
}

export type MetadataExtractionError = Extract<
  ImportError,
  | { readonly kind: 'corrupted-source' }
  | { readonly kind: 'metadata-extraction-failure' }
  | { readonly kind: 'permission-or-access-failure' }
>;

export interface BookMetadataExtractor<F extends ImportFormat> {
  readonly format: F;
  extract(
    source: FileImportSource,
  ): Promise<Result<ExtractedBookMetadata, MetadataExtractionError>>;
}

export function normalizeBookMetadataText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 &&
    normalized.length <= MAX_BOOK_METADATA_TEXT_LENGTH &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)
    ? normalized
    : undefined;
}
