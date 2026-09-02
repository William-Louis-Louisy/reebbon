import type { FileSystemGateway } from '../../../src/infrastructure/filesystem/file-system-gateway';

export class MemoryFileSystemGateway implements FileSystemGateway {
  public readonly documentDirectoryUri = 'file:///documents';
  public readonly cacheDirectoryUri = 'file:///cache';
  public readonly directories = new Set<string>();
  public readonly files = new Set<string>();
  public readonly fileBytes = new Map<string, Uint8Array>();

  public createDirectory(uri: string, idempotent: boolean): Promise<void> {
    if (this.directories.has(uri) && !idempotent) {
      throw new Error('Directory already exists.');
    }
    this.directories.add(uri);
    return Promise.resolve();
  }

  public directoryExists(uri: string): boolean {
    return this.directories.has(uri);
  }

  public fileExists(uri: string): boolean {
    return this.files.has(uri);
  }

  public copyFile(sourceUri: string, destinationUri: string): Promise<void> {
    const bytes = this.fileBytes.get(sourceUri);
    if (!this.files.has(sourceUri) || bytes === undefined) {
      throw new Error('Source file does not exist.');
    }
    this.files.add(destinationUri);
    this.fileBytes.set(destinationUri, bytes.slice());
    return Promise.resolve();
  }

  public writeFile(destinationUri: string, bytes: Uint8Array): Promise<void> {
    this.files.add(destinationUri);
    this.fileBytes.set(destinationUri, bytes.slice());
    return Promise.resolve();
  }

  public moveDirectory(sourceUri: string, destinationUri: string): Promise<void> {
    if (!this.directories.delete(sourceUri)) {
      throw new Error('Staging directory does not exist.');
    }
    this.directories.add(destinationUri);
    for (const file of [...this.files]) {
      if (file.startsWith(`${sourceUri}/`)) {
        this.files.delete(file);
        const destinationFileUri = `${destinationUri}${file.slice(sourceUri.length)}`;
        this.files.add(destinationFileUri);
        const bytes = this.fileBytes.get(file);
        this.fileBytes.delete(file);
        if (bytes !== undefined) {
          this.fileBytes.set(destinationFileUri, bytes);
        }
      }
    }
    return Promise.resolve();
  }

  public deleteDirectory(uri: string): Promise<void> {
    this.directories.delete(uri);
    for (const file of [...this.files]) {
      if (file.startsWith(`${uri}/`)) {
        this.files.delete(file);
        this.fileBytes.delete(file);
      }
    }
    return Promise.resolve();
  }
}
