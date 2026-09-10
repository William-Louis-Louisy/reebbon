import { requireOptionalNativeModule } from 'expo-modules-core';

export interface NativeCbzExtractionResult {
  readonly fileCount: number;
  readonly totalBytes: number;
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
}

let cachedModule: ReebbonImportNativeModule | null | undefined;

export function getReebbonImportNativeModule(): ReebbonImportNativeModule | null {
  cachedModule ??=
    requireOptionalNativeModule<ReebbonImportNativeModule>('ReebbonImport');
  return cachedModule;
}
