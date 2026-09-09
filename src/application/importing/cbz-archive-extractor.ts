import type { Result } from '../../domain';

import type { FileImportSource } from './importer';

export interface ExtractedCbzDirectory {
  readonly uri: string;
}

export type CbzArchiveExtractionError =
  | { readonly kind: 'corrupted-archive' }
  | { readonly kind: 'permission-or-access-failure' }
  | {
      readonly kind: 'filesystem-failure';
      readonly operation: 'extract' | 'cleanup';
    };

export interface CbzArchiveExtractor {
  extract(
    source: FileImportSource,
    extractionId: string,
  ): Promise<Result<ExtractedCbzDirectory, CbzArchiveExtractionError>>;
  cleanup(
    extractionId: string,
  ): Promise<Result<void, CbzArchiveExtractionError>>;
}
