import type { ImportDirectoryEntry, ImportDirectoryReadError } from '../../application';
import { err, ok, type Result } from '../../domain';

export function parseDirectoryEntries(
  value: unknown,
): Result<readonly ImportDirectoryEntry[], ImportDirectoryReadError> {
  if (!Array.isArray(value)) {
    return err({ kind: 'permission-or-access-failure' });
  }

  const entries: ImportDirectoryEntry[] = [];
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      (candidate.kind !== 'file' && candidate.kind !== 'directory') ||
      typeof candidate.uri !== 'string' ||
      candidate.uri.trim().length === 0 ||
      typeof candidate.name !== 'string' ||
      candidate.name.trim().length === 0
    ) {
      return err({ kind: 'permission-or-access-failure' });
    }
    entries.push({
      kind: candidate.kind,
      uri: candidate.uri,
      name: candidate.name,
    });
  }

  return ok(entries);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
