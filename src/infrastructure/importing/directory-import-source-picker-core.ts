import type {
  DirectoryImportSource,
  DirectoryImportSourcePickerError,
} from '../../application';
import { err, ok, type Result } from '../../domain';

const CANCELLATION_CODES = [
  'ERR_PICKER_CANCELLED',
  'ERR_FILE_PICKING_CANCELLED',
] as const;

export function parsePickedDirectory(
  value: unknown,
): Result<DirectoryImportSource | null, DirectoryImportSourcePickerError> {
  if (
    !isRecord(value) ||
    typeof value.uri !== 'string' ||
    value.uri.trim().length === 0 ||
    typeof value.name !== 'string' ||
    value.name.trim().length === 0
  ) {
    return err({ kind: 'permission-or-access-failure' });
  }

  return ok({ kind: 'directory', uri: value.uri, name: value.name });
}

export function isDirectoryPickerCancellation(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    CANCELLATION_CODES.some((code) => code === value.code)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
