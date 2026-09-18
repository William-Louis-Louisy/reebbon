import { requireOptionalNativeModule } from 'expo-modules-core';

export interface CbrExtractionResult {
  readonly directoryUri: string;
  readonly entryCount: number;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly solid: boolean;
}

export interface ReebbonCbrNativeModule {
  extract(sourceUri: string, extractionId: string): Promise<CbrExtractionResult>;
  cleanup(extractionId: string): Promise<void>;
}

export function getReebbonCbrNativeModule(): ReebbonCbrNativeModule | null {
  return requireOptionalNativeModule<ReebbonCbrNativeModule>('ReebbonCbr');
}
