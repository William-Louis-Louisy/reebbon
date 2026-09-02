import type { Result } from '../../domain';

export interface ImportFileReadError {
  readonly kind: 'permission-or-access-failure';
}

export interface ImportFileReader {
  readPrefix(
    uri: string,
    byteLength: number,
  ): Promise<Result<Uint8Array, ImportFileReadError>>;
  readAll(uri: string): Promise<Result<Uint8Array, ImportFileReadError>>;
}
