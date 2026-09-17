import { Directory, File, type FileHandle } from 'expo-file-system';

import type {
  CbzArchiveExtractionError,
  FileImportSource,
} from '../../application';
import { err, type Result } from '../../domain';

import {
  extractCbzChunks,
  type CbzExtractionFileWriter,
  type CbzExtractionTarget,
  type CbzStreamExtractionError,
  type CbzStreamExtractionResult,
} from './cbz-stream-extractor-core';

const READ_CHUNK_BYTES = 1024 * 1024;

export async function extractCbzWithJavaScript(
  source: FileImportSource,
  workspace: Directory,
): Promise<Result<CbzStreamExtractionResult, CbzArchiveExtractionError>> {
  const sourceFile = new File(source.uri);
  if (!sourceFile.exists) {
    return err({ kind: 'permission-or-access-failure' });
  }

  try {
    const extracted = await extractCbzChunks(
      readFileChunks(sourceFile),
      new ExpoCbzExtractionTarget(workspace),
      {
        scheduler: {
          yieldEveryBytes: READ_CHUNK_BYTES,
          yieldControl: yieldToEventLoop,
        },
      },
    );
    return extracted.ok ? extracted : err(mapExtractionError(extracted.error));
  } catch {
    return err({ kind: 'filesystem-failure', operation: 'extract' });
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

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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
