import { File } from 'expo-file-system';

import type {
  ImportFileReader,
  ImportFileReadError,
} from '../../application';
import { err, ok, type Result } from '../../domain';

function readFailure(): ImportFileReadError {
  return { kind: 'permission-or-access-failure' };
}

export class ExpoImportFileReader implements ImportFileReader {
  public async readPrefix(
    uri: string,
    byteLength: number,
  ): Promise<Result<Uint8Array, ImportFileReadError>> {
    if (!Number.isInteger(byteLength) || byteLength <= 0 || uri.trim().length === 0) {
      return err(readFailure());
    }

    try {
      const handle = new File(uri).open();
      try {
        return ok(handle.readBytes(byteLength));
      } finally {
        handle.close();
      }
    } catch {
      return err(readFailure());
    }
  }

  public async readAll(
    uri: string,
  ): Promise<Result<Uint8Array, ImportFileReadError>> {
    if (uri.trim().length === 0) {
      return err(readFailure());
    }

    try {
      return ok(await new File(uri).bytes());
    } catch {
      return err(readFailure());
    }
  }
}
