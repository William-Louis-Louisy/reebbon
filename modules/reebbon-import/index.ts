import { requireOptionalNativeModule } from 'expo-modules-core';

export interface NativeCbzExtractionResult {
  readonly fileCount: number;
  readonly totalBytes: number;
}

export interface NativeLibraryCoverThumbnailResult {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly generated: boolean;
}

export interface ReebbonImportNativeModule {
  extractCbz(
    sourceUri: string,
    destinationUri: string,
  ): Promise<NativeCbzExtractionResult>;
  recordMemoryCheckpoint(
    stage: string,
    details: Readonly<Record<string, boolean | number | string | null>>,
  ): Promise<void>;
  prepareLibraryCoverThumbnail(
    bookId: string,
    sourceUri: string,
    destinationUri: string,
    maxWidth: number,
    maxHeight: number,
  ): Promise<NativeLibraryCoverThumbnailResult>;
}

let cachedModule: ReebbonImportNativeModule | null | undefined;

export function getReebbonImportNativeModule(): ReebbonImportNativeModule | null {
  cachedModule ??=
    requireOptionalNativeModule<ReebbonImportNativeModule>('ReebbonImport');
  return cachedModule;
}
