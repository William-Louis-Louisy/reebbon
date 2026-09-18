import type {
  CbrArchiveExtractor,
  ExtractedCbrDirectory,
} from '../../application';
import { err, ok } from '../../domain';
import type {
  CbrExtractionResult,
  ReebbonCbrNativeModule,
} from '../../../modules/reebbon-cbr';

import { mapNativeCbrExtractionError } from './native-cbr-extraction-error';

export class ExpoCbrArchiveExtractor implements CbrArchiveExtractor {
  public constructor(private readonly nativeModule: ReebbonCbrNativeModule) {}

  public async extract(
    source: Parameters<CbrArchiveExtractor['extract']>[0],
    extractionId: string,
  ) {
    try {
      const result = await this.nativeModule.extract(source.uri, extractionId);
      return validExtractionResult(result)
        ? ok(toExtractedDirectory(result))
        : err({ kind: 'filesystem-failure', operation: 'extract' } as const);
    } catch (error) {
      return err(mapNativeCbrExtractionError(error, 'extract'));
    }
  }

  public async cleanup(extractionId: string) {
    try {
      await this.nativeModule.cleanup(extractionId);
      return ok(undefined);
    } catch (error) {
      return err(mapNativeCbrExtractionError(error, 'cleanup'));
    }
  }
}

export async function loadExpoCbrArchiveExtractor(): Promise<
  ExpoCbrArchiveExtractor | undefined
> {
  try {
    const { getReebbonCbrNativeModule } = await import(
      '../../../modules/reebbon-cbr'
    );
    const nativeModule = getReebbonCbrNativeModule();
    return nativeModule === null
      ? undefined
      : new ExpoCbrArchiveExtractor(nativeModule);
  } catch {
    return undefined;
  }
}

function validExtractionResult(
  result: CbrExtractionResult,
): result is CbrExtractionResult {
  return (
    result.directoryUri.startsWith('file://') &&
    nonNegativeInteger(result.entryCount) &&
    nonNegativeInteger(result.fileCount) &&
    nonNegativeInteger(result.totalBytes) &&
    result.fileCount <= result.entryCount &&
    typeof result.solid === 'boolean'
  );
}

function nonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function toExtractedDirectory(
  result: CbrExtractionResult,
): ExtractedCbrDirectory {
  return {
    uri: result.directoryUri,
    entryCount: result.entryCount,
    fileCount: result.fileCount,
    totalBytes: result.totalBytes,
    solid: result.solid,
  };
}
