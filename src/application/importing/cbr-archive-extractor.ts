import type { Result } from '../../domain';

import type { FileImportSource } from './importer';

export interface ExtractedCbrDirectory {
  readonly uri: string;
  readonly entryCount: number;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly solid: boolean;
}

export type CbrArchiveExtractionError =
  | { readonly kind: 'corrupted-archive' }
  | { readonly kind: 'encrypted-archive' }
  | { readonly kind: 'multi-volume-archive' }
  | { readonly kind: 'limits-exceeded' }
  | { readonly kind: 'unsafe-archive' }
  | { readonly kind: 'permission-or-access-failure' }
  | {
      readonly kind: 'filesystem-failure';
      readonly operation: 'extract' | 'cleanup';
    };

export interface CbrArchiveExtractor {
  extract(
    source: FileImportSource,
    extractionId: string,
  ): Promise<Result<ExtractedCbrDirectory, CbrArchiveExtractionError>>;
  cleanup(
    extractionId: string,
  ): Promise<Result<void, CbrArchiveExtractionError>>;
}
