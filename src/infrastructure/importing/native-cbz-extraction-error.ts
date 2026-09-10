import type { CbzArchiveExtractionError } from '../../application';

interface CodedNativeError {
  readonly code: string;
}

export function mapNativeCbzExtractionError(
  error: unknown,
): CbzArchiveExtractionError {
  if (isCodedNativeError(error)) {
    if (error.code === 'ERR_CBZ_CORRUPTED_ARCHIVE') {
      return { kind: 'corrupted-archive' };
    }
    if (error.code === 'ERR_CBZ_PERMISSION_OR_ACCESS_FAILURE') {
      return { kind: 'permission-or-access-failure' };
    }
  }
  return { kind: 'filesystem-failure', operation: 'extract' };
}

function isCodedNativeError(value: unknown): value is CodedNativeError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string'
  );
}
