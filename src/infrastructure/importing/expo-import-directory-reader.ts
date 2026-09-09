import { Directory, File } from 'expo-file-system';

import type {
  ImportDirectoryEntry,
  ImportDirectoryReader,
} from '../../application';
import { err } from '../../domain';

import { parseDirectoryEntries } from './import-directory-reader-core';

type ListDirectory = (uri: string) => unknown;

export class ExpoImportDirectoryReader implements ImportDirectoryReader {
  public constructor(
    private readonly listDirectory: ListDirectory = listExpoDirectory,
  ) {}

  public async list(source: Parameters<ImportDirectoryReader['list']>[0]) {
    try {
      return parseDirectoryEntries(this.listDirectory(source.uri));
    } catch {
      return err({ kind: 'permission-or-access-failure' } as const);
    }
  }
}

function listExpoDirectory(uri: string): readonly ImportDirectoryEntry[] {
  return new Directory(uri).list().map((entry) => ({
    kind: entry instanceof File ? 'file' : 'directory',
    uri: entry.uri,
    name: entry.name,
  }));
}
