import type { Result } from '../../domain';

import type { DirectoryImportSource } from './importer';

export interface ImportDirectoryEntry {
  readonly kind: 'file' | 'directory';
  readonly uri: string;
  readonly name: string;
}

export interface ImportDirectoryReadError {
  readonly kind: 'permission-or-access-failure';
}

export interface ImportDirectoryReader {
  list(
    source: DirectoryImportSource,
  ): Promise<Result<readonly ImportDirectoryEntry[], ImportDirectoryReadError>>;
}
