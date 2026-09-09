import { Unzip, UnzipInflate } from 'fflate';

import { err, ok, type Result } from '../../domain';

const DEFAULT_CHUNK_LIMITS: CbzExtractionLimits = {
  maxEntries: 10_000,
  maxEntryBytes: 512 * 1024 * 1024,
  maxTotalBytes: 4 * 1024 * 1024 * 1024,
  maxPathLength: 1024,
};
const ZIP_END_RECORD_MAX_BYTES = 65_535 + 22;

export interface CbzExtractionLimits {
  readonly maxEntries: number;
  readonly maxEntryBytes: number;
  readonly maxTotalBytes: number;
  readonly maxPathLength: number;
}

export interface CbzExtractionFileWriter {
  write(bytes: Uint8Array): void;
  close(): void;
}

export interface CbzExtractionTarget {
  createDirectory(relativePath: string): void;
  createFile(relativePath: string): CbzExtractionFileWriter;
}

export type CbzStreamExtractionError =
  | { readonly kind: 'invalid-archive' }
  | { readonly kind: 'source-read-failure' }
  | { readonly kind: 'write-failure' };

export interface CbzStreamExtractionResult {
  readonly fileCount: number;
  readonly totalBytes: number;
}

export function extractCbzChunks(
  chunks: Iterable<Uint8Array>,
  target: CbzExtractionTarget,
  limits: CbzExtractionLimits = DEFAULT_CHUNK_LIMITS,
): Result<CbzStreamExtractionResult, CbzStreamExtractionError> {
  const openWriters = new Set<CbzExtractionFileWriter>();
  const paths = new Set<string>();
  let entryCount = 0;
  let fileCount = 0;
  let totalBytes = 0;
  let failure: CbzStreamExtractionError | undefined;

  const fail = (error: CbzStreamExtractionError) => {
    failure ??= error;
  };
  const unzip = new Unzip((file) => {
    if (failure !== undefined) {
      return;
    }

    entryCount += 1;
    if (entryCount > limits.maxEntries) {
      fail({ kind: 'invalid-archive' });
      return;
    }

    const path = normalizeArchivePath(file.name, limits.maxPathLength);
    if (path === undefined || paths.has(path.relativePath)) {
      fail({ kind: 'invalid-archive' });
      return;
    }
    paths.add(path.relativePath);

    try {
      if (path.isDirectory) {
        target.createDirectory(path.relativePath);
        return;
      }
      createParentDirectories(target, path.relativePath);
    } catch {
      fail({ kind: 'write-failure' });
      return;
    }

    if (
      file.originalSize !== undefined &&
      (file.originalSize > limits.maxEntryBytes ||
        file.originalSize > limits.maxTotalBytes - totalBytes)
    ) {
      fail({ kind: 'invalid-archive' });
      return;
    }

    let writer: CbzExtractionFileWriter;
    try {
      writer = target.createFile(path.relativePath);
      openWriters.add(writer);
      fileCount += 1;
    } catch {
      fail({ kind: 'write-failure' });
      return;
    }

    let entryBytes = 0;
    file.ondata = (error, data, final) => {
      if (error !== null) {
        fail({ kind: 'invalid-archive' });
        closeWriter(writer, openWriters, fail);
        return;
      }
      if (failure !== undefined) {
        closeWriter(writer, openWriters, fail);
        return;
      }

      entryBytes += data.byteLength;
      totalBytes += data.byteLength;
      if (
        entryBytes > limits.maxEntryBytes ||
        totalBytes > limits.maxTotalBytes
      ) {
        fail({ kind: 'invalid-archive' });
        closeWriter(writer, openWriters, fail);
        return;
      }

      try {
        if (data.byteLength > 0) {
          writer.write(data);
        }
      } catch {
        fail({ kind: 'write-failure' });
        closeWriter(writer, openWriters, fail);
        return;
      }

      if (final) {
        if (
          file.originalSize !== undefined &&
          entryBytes !== file.originalSize
        ) {
          fail({ kind: 'invalid-archive' });
        }
        closeWriter(writer, openWriters, fail);
      }
    };

    try {
      file.start();
    } catch {
      fail({ kind: 'invalid-archive' });
      closeWriter(writer, openWriters, fail);
    }
  });
  unzip.register(UnzipInflate);

  const pushed = pushArchiveChunks(unzip, chunks, () => failure);
  if (!pushed.ok) {
    fail(pushed.error);
  } else if (!hasValidCentralDirectory(pushed.value, entryCount)) {
    fail({ kind: 'invalid-archive' });
  }
  closeOpenWriters(openWriters, fail);

  if (failure !== undefined || openWriters.size > 0) {
    return err(failure ?? { kind: 'invalid-archive' });
  }
  return ok({ fileCount, totalBytes });
}

interface NormalizedArchivePath {
  readonly relativePath: string;
  readonly isDirectory: boolean;
}

function normalizeArchivePath(
  value: string,
  maxPathLength: number,
): NormalizedArchivePath | undefined {
  if (
    value.length === 0 ||
    value.length > maxPathLength ||
    value.includes('\\') ||
    value.includes('\0') ||
    value.startsWith('/') ||
    /^[A-Za-z]:/.test(value)
  ) {
    return undefined;
  }

  const isDirectory = value.endsWith('/');
  const withoutTrailingSlash = isDirectory ? value.slice(0, -1) : value;
  const segments = withoutTrailingSlash.split('/');
  if (
    segments.length === 0 ||
    segments.some(
      (segment) => segment.length === 0 || segment === '.' || segment === '..',
    )
  ) {
    return undefined;
  }

  return { relativePath: segments.join('/'), isDirectory };
}

function createParentDirectories(
  target: CbzExtractionTarget,
  relativePath: string,
): void {
  const segments = relativePath.split('/');
  for (let index = 1; index < segments.length; index += 1) {
    target.createDirectory(segments.slice(0, index).join('/'));
  }
}

function closeWriter(
  writer: CbzExtractionFileWriter,
  openWriters: Set<CbzExtractionFileWriter>,
  fail: (error: CbzStreamExtractionError) => void,
): void {
  if (!openWriters.delete(writer)) {
    return;
  }
  try {
    writer.close();
  } catch {
    fail({ kind: 'write-failure' });
  }
}

function closeOpenWriters(
  writers: Set<CbzExtractionFileWriter>,
  fail: (error: CbzStreamExtractionError) => void,
): void {
  for (const writer of [...writers]) {
    closeWriter(writer, writers, fail);
  }
}

function pushArchiveChunks(
  unzip: Unzip,
  chunks: Iterable<Uint8Array>,
  getFailure: () => CbzStreamExtractionError | undefined,
): Result<ArchiveTail, CbzStreamExtractionError> {
  let previous: Uint8Array | undefined;
  let archiveBytes = 0;
  let tail: Uint8Array = new Uint8Array();
  let iterator: Iterator<Uint8Array>;
  try {
    iterator = chunks[Symbol.iterator]();
  } catch {
    return err({ kind: 'source-read-failure' });
  }

  while (true) {
    let next: IteratorResult<Uint8Array>;
    try {
      next = iterator.next();
    } catch {
      return err({ kind: 'source-read-failure' });
    }

    if (next.done) {
      try {
        unzip.push(previous ?? new Uint8Array(), true);
      } catch {
        return err({ kind: 'invalid-archive' });
      }
      return getFailure() === undefined
        ? ok({ archiveBytes, bytes: tail })
        : err(getFailure() ?? { kind: 'invalid-archive' });
    }
    if (!(next.value instanceof Uint8Array)) {
      return err({ kind: 'source-read-failure' });
    }
    archiveBytes += next.value.byteLength;
    tail = appendArchiveTail(tail, next.value);

    if (previous !== undefined) {
      try {
        unzip.push(previous, false);
      } catch {
        return err({ kind: 'invalid-archive' });
      }
      if (getFailure() !== undefined) {
        return err(getFailure() ?? { kind: 'invalid-archive' });
      }
    }
    previous = next.value;
  }
}

interface ArchiveTail {
  readonly archiveBytes: number;
  readonly bytes: Uint8Array;
}

function appendArchiveTail(
  current: Uint8Array,
  chunk: Uint8Array,
): Uint8Array {
  if (chunk.byteLength >= ZIP_END_RECORD_MAX_BYTES) {
    return chunk.slice(chunk.byteLength - ZIP_END_RECORD_MAX_BYTES);
  }

  const retainedBytes = Math.min(
    current.byteLength,
    ZIP_END_RECORD_MAX_BYTES - chunk.byteLength,
  );
  const combined = new Uint8Array(retainedBytes + chunk.byteLength);
  combined.set(current.subarray(current.byteLength - retainedBytes));
  combined.set(chunk, retainedBytes);
  return combined;
}

function hasValidCentralDirectory(
  archive: ArchiveTail,
  extractedEntries: number,
): boolean {
  const bytes = archive.bytes;
  for (let offset = bytes.byteLength - 22; offset >= 0; offset -= 1) {
    if (!startsWithAt(bytes, offset, [0x50, 0x4b, 0x05, 0x06])) {
      continue;
    }

    const commentLength = readUint16(bytes, offset + 20);
    if (offset + 22 + commentLength !== bytes.byteLength) {
      continue;
    }
    const disk = readUint16(bytes, offset + 4);
    const centralDisk = readUint16(bytes, offset + 6);
    const diskEntries = readUint16(bytes, offset + 8);
    const totalEntries = readUint16(bytes, offset + 10);
    const centralSize = readUint32(bytes, offset + 12);
    const centralOffset = readUint32(bytes, offset + 16);
    const endRecordOffset = archive.archiveBytes - bytes.byteLength + offset;
    const usesZip64 =
      diskEntries === 0xffff ||
      totalEntries === 0xffff ||
      centralSize === 0xffffffff ||
      centralOffset === 0xffffffff;

    return (
      !usesZip64 &&
      disk === 0 &&
      centralDisk === 0 &&
      diskEntries === totalEntries &&
      totalEntries === extractedEntries &&
      centralOffset + centralSize <= endRecordOffset
    );
  }
  return false;
}

function startsWithAt(
  bytes: Uint8Array,
  offset: number,
  signature: readonly number[],
): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}
