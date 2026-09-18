import type { CbrArchiveExtractionError } from '../../application';

interface NativeCbrError {
  readonly code?: unknown;
}

const limitCodes = new Set([
  'ERR_CBR_ARCHIVE_SIZE_LIMIT',
  'ERR_CBR_DICTIONARY_LIMIT',
  'ERR_CBR_ENTRY_COUNT_LIMIT',
  'ERR_CBR_ENTRY_SIZE_LIMIT',
  'ERR_CBR_NATIVE_MEMORY',
  'ERR_CBR_SIZE_LIMIT',
  'ERR_CBR_TOTAL_SIZE_LIMIT',
]);

const unsafeCodes = new Set([
  'ERR_CBR_DECLARED_SIZE_MISMATCH',
  'ERR_CBR_DUPLICATE_PATH',
  'ERR_CBR_LINK_UNSUPPORTED',
  'ERR_CBR_UNSAFE_PATH',
]);

export function mapNativeCbrExtractionError(
  error: unknown,
  operation: 'extract' | 'cleanup',
): CbrArchiveExtractionError {
  const code = nativeErrorCode(error);
  if (operation === 'cleanup') {
    return { kind: 'filesystem-failure', operation: 'cleanup' };
  }
  if (code === 'ERR_CBR_ENCRYPTED_ARCHIVE') {
    return { kind: 'encrypted-archive' };
  }
  if (code === 'ERR_CBR_MULTIVOLUME_UNSUPPORTED') {
    return { kind: 'multi-volume-archive' };
  }
  if (code !== undefined && limitCodes.has(code)) {
    return { kind: 'limits-exceeded' };
  }
  if (code !== undefined && unsafeCodes.has(code)) {
    return { kind: 'unsafe-archive' };
  }
  if (code === 'ERR_CBR_CORRUPTED_ARCHIVE') {
    return { kind: 'corrupted-archive' };
  }
  if (code === 'ERR_CBR_SOURCE_ACCESS') {
    return { kind: 'permission-or-access-failure' };
  }
  return { kind: 'filesystem-failure', operation: 'extract' };
}

function nativeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const code = (error as NativeCbrError).code;
  return typeof code === 'string' ? code : undefined;
}
