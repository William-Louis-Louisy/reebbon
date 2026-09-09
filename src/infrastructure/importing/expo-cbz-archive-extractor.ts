import { Directory, File, Paths, type FileHandle } from 'expo-file-system';

import type {
  CbzArchiveExtractionError,
  CbzArchiveExtractor,
  ExtractedCbzDirectory,
  FileImportSource,
} from '../../application';
import { err, ok, type Result } from '../../domain';

import {
  extractCbzChunks,
  type CbzExtractionFileWriter,
  type CbzExtractionTarget,
  type CbzStreamExtractionError,
} from './cbz-stream-extractor-core';

const READ_CHUNK_BYTES = 64 * 1024;
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

    const sourceFile = new File(source.uri);
    if (!sourceFile.exists) {
      return err({ kind: 'permission-or-access-failure' });
    }

    let extracted: ReturnType<typeof extractCbzChunks>;
    try {
      extracted = extractCbzChunks(
        readFileChunks(sourceFile),
        new ExpoCbzExtractionTarget(workspace),
      );
    } catch {
      return err({ kind: 'filesystem-failure', operation: 'extract' });
    }

    return extracted.ok
      ? ok({ uri: workspace.uri })
      : err(mapExtractionError(extracted.error));
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

class ExpoCbzExtractionTarget implements CbzExtractionTarget {
  public constructor(private readonly root: Directory) {}

  public createDirectory(relativePath: string): void {
    new Directory(this.root, ...relativePath.split('/')).create({
      idempotent: true,
      intermediates: true,
    });
  }

  public createFile(relativePath: string): CbzExtractionFileWriter {
    const file = new File(this.root, ...relativePath.split('/'));
    file.create({ intermediates: true, overwrite: false });
    return new ExpoFileWriter(file.open());
  }
}

class ExpoFileWriter implements CbzExtractionFileWriter {
  public constructor(private readonly handle: FileHandle) {}

  public write(bytes: Uint8Array): void {
    this.handle.writeBytes(bytes);
  }

  public close(): void {
    this.handle.close();
  }
}

function* readFileChunks(file: File): Iterable<Uint8Array> {
  let handle: FileHandle | undefined;
  try {
    handle = file.open();
    while (true) {
      const chunk = handle.readBytes(READ_CHUNK_BYTES);
      if (chunk.byteLength === 0) {
        return;
      }
      yield chunk;
    }
  } finally {
    handle?.close();
  }
}

function mapExtractionError(
  error: CbzStreamExtractionError,
): CbzArchiveExtractionError {
  switch (error.kind) {
    case 'invalid-archive':
      return { kind: 'corrupted-archive' };
    case 'source-read-failure':
      return { kind: 'permission-or-access-failure' };
    case 'write-failure':
      return { kind: 'filesystem-failure', operation: 'extract' };
  }
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}
