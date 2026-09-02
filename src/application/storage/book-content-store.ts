import type { BookId, Result } from '../../domain';

export type FileStorageOperation =
  | 'initialize'
  | 'create-staging-area'
  | 'stage-file'
  | 'stage-bytes'
  | 'commit-staging-area'
  | 'remove-staging-area'
  | 'remove-book-files';

export type FileStorageError =
  | { readonly kind: 'invalid-storage-path'; readonly operation: FileStorageOperation }
  | {
      readonly kind: 'permission-or-access-failure';
      readonly operation: FileStorageOperation;
    }
  | { readonly kind: 'filesystem-failure'; readonly operation: FileStorageOperation };

export interface StagingArea {
  readonly id: string;
  readonly uri: string;
}

export interface StoredBookContent {
  readonly bookId: BookId;
  readonly uri: string;
}

export interface BookContentStore {
  initialize(): Promise<Result<void, FileStorageError>>;
  createStagingArea(importId: string): Promise<Result<StagingArea, FileStorageError>>;
  stageFile(
    importId: string,
    sourceUri: string,
    destinationName: string,
  ): Promise<Result<string, FileStorageError>>;
  stageBytes(
    importId: string,
    bytes: Uint8Array,
    destinationName: string,
  ): Promise<Result<string, FileStorageError>>;
  commitStagingArea(
    importId: string,
    bookId: BookId,
  ): Promise<Result<StoredBookContent, FileStorageError>>;
  removeStagingArea(importId: string): Promise<Result<void, FileStorageError>>;
  removeBookFiles(bookId: BookId): Promise<Result<void, FileStorageError>>;
}
