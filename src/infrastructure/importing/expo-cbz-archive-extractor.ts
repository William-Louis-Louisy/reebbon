import { Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type {
  CbzArchiveExtractionError,
  CbzArchiveExtractor,
  ExtractedCbzDirectory,
  FileImportSource,
} from '../../application';
import { err, ok, type Result } from '../../domain';

import type { ReebbonImportNativeModule } from '../../../modules/reebbon-import';
import { selectCbzExtractionStrategy } from './cbz-extraction-strategy';
import { mapNativeCbzExtractionError } from './native-cbz-extraction-error';

const EXTRACTION_ROOT_NAME = 'cbz-extraction';
const STORAGE_ROOT_NAME = 'reebbon';

export class ExpoCbzArchiveExtractor implements CbzArchiveExtractor {
  private readonly root = new Directory(
    Paths.cache,
    STORAGE_ROOT_NAME,
    EXTRACTION_ROOT_NAME,
  );

  public async extract(
    source: FileImportSource,
    extractionId: string,
  ): Promise<Result<ExtractedCbzDirectory, CbzArchiveExtractionError>> {
    if (!isSafeIdentifier(extractionId) || source.uri.trim().length === 0) {
      return err({ kind: 'filesystem-failure', operation: 'extract' });
    }

    const workspace = new Directory(this.root, extractionId);
    try {
      this.root.create({ idempotent: true, intermediates: true });
      workspace.create({ idempotent: false, intermediates: false });
    } catch {
      return err({ kind: 'filesystem-failure', operation: 'extract' });
    }

    const nativeModule =
      Platform.OS === 'android' ? await loadNativeModule() : null;
    const strategy = selectCbzExtractionStrategy(
      Platform.OS,
      nativeModule !== null,
    );

    if (strategy === 'unavailable') {
      return err({ kind: 'filesystem-failure', operation: 'extract' });
    }
    if (strategy === 'native' && nativeModule !== null) {
      return extractWithNativeModule(nativeModule, source, workspace);
    }

    const { extractCbzWithJavaScript } = await import(
      './expo-js-cbz-extraction'
    );
    const extracted = await extractCbzWithJavaScript(source, workspace);
    return extracted.ok ? ok({ uri: workspace.uri }) : err(extracted.error);
  }

  public async cleanup(
    extractionId: string,
  ): Promise<Result<void, CbzArchiveExtractionError>> {
    if (!isSafeIdentifier(extractionId)) {
      return err({ kind: 'filesystem-failure', operation: 'cleanup' });
    }

    try {
      const workspace = new Directory(this.root, extractionId);
      if (workspace.exists) {
        workspace.delete();
      }
      return ok(undefined);
    } catch {
      return err({ kind: 'filesystem-failure', operation: 'cleanup' });
    }
  }
}

async function loadNativeModule(): Promise<ReebbonImportNativeModule | null> {
  try {
    const { getReebbonImportNativeModule } = await import(
      '../../../modules/reebbon-import'
    );
    return getReebbonImportNativeModule();
  } catch {
    return null;
  }
}

async function extractWithNativeModule(
  nativeModule: ReebbonImportNativeModule,
  source: FileImportSource,
  workspace: Directory,
): Promise<Result<ExtractedCbzDirectory, CbzArchiveExtractionError>> {
  try {
    await nativeModule.extractCbz(source.uri, workspace.uri);
    return ok({ uri: workspace.uri });
  } catch (error: unknown) {
    return err(mapNativeCbzExtractionError(error));
  }
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}
