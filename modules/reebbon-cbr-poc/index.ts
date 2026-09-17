import { requireOptionalNativeModule } from 'expo-modules-core';

export interface CbrPocExtractionResult {
  readonly directoryPath: string;
  readonly entryCount: number;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly solid: boolean;
}

export interface ReebbonCbrPocNativeModule {
  extract(sourcePath: string): Promise<CbrPocExtractionResult>;
  cleanup(destinationPath: string): Promise<void>;
}

export function getReebbonCbrPocNativeModule(): ReebbonCbrPocNativeModule | null {
  return requireOptionalNativeModule<ReebbonCbrPocNativeModule>('ReebbonCbrPoc');
}
