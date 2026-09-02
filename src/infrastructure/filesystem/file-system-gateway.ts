export interface FileSystemGateway {
  readonly documentDirectoryUri: string;
  readonly cacheDirectoryUri: string;

  createDirectory(uri: string, idempotent: boolean): Promise<void>;
  directoryExists(uri: string): boolean;
  fileExists(uri: string): boolean;
  copyFile(sourceUri: string, destinationUri: string): Promise<void>;
  writeFile(destinationUri: string, bytes: Uint8Array): Promise<void>;
  moveDirectory(sourceUri: string, destinationUri: string): Promise<void>;
  deleteDirectory(uri: string): Promise<void>;
}
