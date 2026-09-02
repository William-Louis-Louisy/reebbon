import { Directory, File, Paths } from 'expo-file-system';

import type { FileSystemGateway } from './file-system-gateway';

export class ExpoFileSystemGateway implements FileSystemGateway {
  public readonly documentDirectoryUri = Paths.document.uri;
  public readonly cacheDirectoryUri = Paths.cache.uri;

  public createDirectory(uri: string, idempotent: boolean): Promise<void> {
    new Directory(uri).create({ idempotent, intermediates: true });
    return Promise.resolve();
  }

  public directoryExists(uri: string): boolean {
    return new Directory(uri).exists;
  }

  public fileExists(uri: string): boolean {
    return new File(uri).exists;
  }

  public async copyFile(sourceUri: string, destinationUri: string): Promise<void> {
    await new File(sourceUri).copy(new File(destinationUri));
  }

  public writeFile(destinationUri: string, bytes: Uint8Array): Promise<void> {
    const file = new File(destinationUri);
    file.create({ overwrite: false });
    file.write(bytes);
    return Promise.resolve();
  }

  public async moveDirectory(sourceUri: string, destinationUri: string): Promise<void> {
    await new Directory(sourceUri).move(new Directory(destinationUri));
  }

  public deleteDirectory(uri: string): Promise<void> {
    new Directory(uri).delete();
    return Promise.resolve();
  }
}
