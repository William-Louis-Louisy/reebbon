import {
  err,
  ok,
  type BookId,
  type Result,
} from '../../domain';
import type {
  BookContentStore,
  FileStorageError,
  FileStorageOperation,
  StagingArea,
  StoredBookContent,
} from '../../application';

import type { FileSystemGateway } from './file-system-gateway';

const STORAGE_ROOT_NAME = 'reebbon';
const BOOKS_DIRECTORY_NAME = 'books';
const IMPORT_STAGING_DIRECTORY_NAME = 'import-staging';

function joinUri(root: string, ...segments: readonly string[]): string {
  return `${root.replace(/\/+$/, '')}/${segments.join('/')}`;
}

function isSafePathSegment(value: string): boolean {
  return (
    value !== '.' &&
    value !== '..' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
  );
}

function hasErrorCode(value: unknown, codes: readonly string[]): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    codes.includes(value.code)
  );
}

function mapFileSystemError(
  error: unknown,
  operation: FileStorageOperation,
): FileStorageError {
  return hasErrorCode(error, ['EACCES', 'EPERM', 'ERR_FILESYSTEM_PERMISSIONS'])
    ? { kind: 'permission-or-access-failure', operation }
    : { kind: 'filesystem-failure', operation };
}

export class LocalBookContentStore implements BookContentStore {
  private readonly booksRootUri: string;
  private readonly stagingRootUri: string;

  public constructor(private readonly fileSystem: FileSystemGateway) {
    this.booksRootUri = joinUri(
      fileSystem.documentDirectoryUri,
      STORAGE_ROOT_NAME,
      BOOKS_DIRECTORY_NAME,
    );
    this.stagingRootUri = joinUri(
      fileSystem.cacheDirectoryUri,
      STORAGE_ROOT_NAME,
      IMPORT_STAGING_DIRECTORY_NAME,
    );
  }

  public async initialize(): Promise<Result<void, FileStorageError>> {
    try {
      await this.fileSystem.createDirectory(this.booksRootUri, true);
      await this.fileSystem.createDirectory(this.stagingRootUri, true);
      return ok(undefined);
    } catch (error: unknown) {
      return err(mapFileSystemError(error, 'initialize'));
    }
  }

  public async createStagingArea(
    importId: string,
  ): Promise<Result<StagingArea, FileStorageError>> {
    if (!isSafePathSegment(importId)) {
      return err({ kind: 'invalid-storage-path', operation: 'create-staging-area' });
    }

    const uri = joinUri(this.stagingRootUri, importId);
    try {
      await this.fileSystem.createDirectory(uri, false);
      return ok({ id: importId, uri });
    } catch (error: unknown) {
      return err(mapFileSystemError(error, 'create-staging-area'));
    }
  }

  public async stageFile(
    importId: string,
    sourceUri: string,
    destinationName: string,
  ): Promise<Result<string, FileStorageError>> {
    if (
      !isSafePathSegment(importId) ||
      !isSafePathSegment(destinationName) ||
      sourceUri.trim().length === 0
    ) {
      return err({ kind: 'invalid-storage-path', operation: 'stage-file' });
    }

    const stagingUri = joinUri(this.stagingRootUri, importId);
    const destinationUri = joinUri(stagingUri, destinationName);
    try {
      if (!this.fileSystem.directoryExists(stagingUri)) {
        return err({ kind: 'filesystem-failure', operation: 'stage-file' });
      }
      if (!this.fileSystem.fileExists(sourceUri)) {
        return err({ kind: 'permission-or-access-failure', operation: 'stage-file' });
      }

      await this.fileSystem.copyFile(sourceUri, destinationUri);
      return ok(destinationUri);
    } catch (error: unknown) {
      return err(mapFileSystemError(error, 'stage-file'));
    }
  }

  public async stageBytes(
    importId: string,
    bytes: Uint8Array,
    destinationName: string,
  ): Promise<Result<string, FileStorageError>> {
    if (
      !isSafePathSegment(importId) ||
      !isSafePathSegment(destinationName) ||
      bytes.byteLength === 0
    ) {
      return err({ kind: 'invalid-storage-path', operation: 'stage-bytes' });
    }

    const stagingUri = joinUri(this.stagingRootUri, importId);
    const destinationUri = joinUri(stagingUri, destinationName);
    try {
      if (!this.fileSystem.directoryExists(stagingUri)) {
        return err({ kind: 'filesystem-failure', operation: 'stage-bytes' });
      }

      await this.fileSystem.writeFile(destinationUri, bytes);
      return ok(destinationUri);
    } catch (error: unknown) {
      return err(mapFileSystemError(error, 'stage-bytes'));
    }
  }

  public async commitStagingArea(
    importId: string,
    bookId: BookId,
  ): Promise<Result<StoredBookContent, FileStorageError>> {
    if (!isSafePathSegment(importId) || !isSafePathSegment(bookId)) {
      return err({ kind: 'invalid-storage-path', operation: 'commit-staging-area' });
    }

    const stagingUri = joinUri(this.stagingRootUri, importId);
    const bookUri = joinUri(this.booksRootUri, bookId);
    try {
      if (
        !this.fileSystem.directoryExists(stagingUri) ||
        this.fileSystem.directoryExists(bookUri)
      ) {
        return err({ kind: 'filesystem-failure', operation: 'commit-staging-area' });
      }

      await this.fileSystem.moveDirectory(stagingUri, bookUri);
      return ok({ bookId, uri: bookUri });
    } catch (error: unknown) {
      return err(mapFileSystemError(error, 'commit-staging-area'));
    }
  }

  public removeStagingArea(importId: string): Promise<Result<void, FileStorageError>> {
    return this.removeOwnedDirectory(importId, this.stagingRootUri, 'remove-staging-area');
  }

  public removeBookFiles(bookId: BookId): Promise<Result<void, FileStorageError>> {
    return this.removeOwnedDirectory(bookId, this.booksRootUri, 'remove-book-files');
  }

  private async removeOwnedDirectory(
    id: string,
    rootUri: string,
    operation: 'remove-staging-area' | 'remove-book-files',
  ): Promise<Result<void, FileStorageError>> {
    if (!isSafePathSegment(id)) {
      return err({ kind: 'invalid-storage-path', operation });
    }

    const uri = joinUri(rootUri, id);
    try {
      if (!this.fileSystem.directoryExists(uri)) {
        return ok(undefined);
      }

      await this.fileSystem.deleteDirectory(uri);
      return ok(undefined);
    } catch (error: unknown) {
      return err(mapFileSystemError(error, operation));
    }
  }
}
