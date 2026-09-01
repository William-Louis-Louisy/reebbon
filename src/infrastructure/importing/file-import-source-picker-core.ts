import type {
  FileImportSourcePickerError,
  PickFileImportSourceOptions,
} from '../../application';
import type { FileImportSource } from '../../application/importing/importer';
import { err, ok, type Result } from '../../domain';

export interface NativeDocumentPickerOptions {
  readonly copyToCacheDirectory: true;
  readonly multiple: false;
  readonly type: string | string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function nativeDocumentPickerOptions(
  options: PickFileImportSourceOptions,
): NativeDocumentPickerOptions {
  return {
    copyToCacheDirectory: true,
    multiple: false,
    type: options.mimeTypes.length > 0 ? [...options.mimeTypes] : '*/*',
  };
}

export function parsePickedDocument(
  result: unknown,
): Result<FileImportSource | null, FileImportSourcePickerError> {
  if (!isRecord(result) || typeof result.canceled !== 'boolean') {
    return err({ kind: 'permission-or-access-failure' });
  }
  if (result.canceled) {
    return ok(null);
  }
  if (!Array.isArray(result.assets) || result.assets.length !== 1) {
    return err({ kind: 'permission-or-access-failure' });
  }

  const asset: unknown = result.assets[0];
  if (
    !isRecord(asset) ||
    typeof asset.uri !== 'string' ||
    asset.uri.trim().length === 0 ||
    typeof asset.name !== 'string' ||
    asset.name.trim().length === 0 ||
    !(
      asset.mimeType === undefined ||
      (typeof asset.mimeType === 'string' && asset.mimeType.trim().length > 0)
    )
  ) {
    return err({ kind: 'permission-or-access-failure' });
  }

  return ok({
    kind: 'file',
    uri: asset.uri,
    name: asset.name,
    ...(asset.mimeType === undefined ? {} : { mimeType: asset.mimeType }),
  });
}
