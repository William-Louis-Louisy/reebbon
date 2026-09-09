import { Directory, File } from 'expo-file-system';

import type { ImageSetPageProvider } from '../../application';
import { err } from '../../domain';

import { parseStoredImageSetPages } from './image-set-page-provider-core';

export class ExpoImageSetPageProvider implements ImageSetPageProvider {
  public async getPages(
    contentUri: string,
    expectedTotalPages: number,
  ): ReturnType<ImageSetPageProvider['getPages']> {
    try {
      const entries = new Directory(contentUri).list().map((entry) => ({
        kind: entry instanceof File ? ('file' as const) : ('directory' as const),
        name: entry.name,
        uri: entry.uri,
      }));
      return parseStoredImageSetPages(
        entries,
        contentUri,
        expectedTotalPages,
      );
    } catch {
      return err({ kind: 'content-access-failure' });
    }
  }
}
