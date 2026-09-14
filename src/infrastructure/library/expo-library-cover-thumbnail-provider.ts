import { Platform } from 'react-native';

import type {
  LibraryCoverThumbnailError,
  LibraryCoverThumbnailProvider,
  PreparedLibraryCover,
} from '../../application';
import { err, ok, type Result } from '../../domain';
import { getReebbonImportNativeModule } from '../../../modules/reebbon-import';

const THUMBNAIL_NAME = 'library-cover-thumbnail.jpg';
const THUMBNAIL_MAX_WIDTH_PX = 720;
const THUMBNAIL_MAX_HEIGHT_PX = 1056;

export class ExpoLibraryCoverThumbnailProvider
  implements LibraryCoverThumbnailProvider
{
  private readonly pending = new Map<
    string,
    Promise<Result<PreparedLibraryCover, LibraryCoverThumbnailError>>
  >();

  public prepare(
    bookId: string,
    sourceUri: string,
  ): Promise<Result<PreparedLibraryCover, LibraryCoverThumbnailError>> {
    if (Platform.OS !== 'android' || isVectorCover(sourceUri)) {
      return Promise.resolve(ok({ uri: sourceUri }));
    }

    const key = `${bookId}:${sourceUri}`;
    const current = this.pending.get(key);
    if (current !== undefined) {
      return current;
    }

    const preparation = this.prepareAndroid(bookId, sourceUri).finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, preparation);
    return preparation;
  }

  private async prepareAndroid(
    bookId: string,
    sourceUri: string,
  ): Promise<Result<PreparedLibraryCover, LibraryCoverThumbnailError>> {
    const destinationUri = thumbnailUriFor(sourceUri);
    const nativeModule = getReebbonImportNativeModule();
    if (destinationUri === undefined || nativeModule === null) {
      return err({ kind: 'thumbnail-unavailable' });
    }

    try {
      const result = await nativeModule.prepareLibraryCoverThumbnail(
        bookId,
        sourceUri,
        destinationUri,
        THUMBNAIL_MAX_WIDTH_PX,
        THUMBNAIL_MAX_HEIGHT_PX,
      );
      return result.uri === destinationUri && result.width > 0 && result.height > 0
        ? ok({ uri: result.uri })
        : err({ kind: 'thumbnail-unavailable' });
    } catch {
      return err({ kind: 'thumbnail-unavailable' });
    }
  }
}

function isVectorCover(sourceUri: string): boolean {
  return /\.svg(?:[?#]|$)/i.test(sourceUri);
}

export function thumbnailUriFor(sourceUri: string): string | undefined {
  if (!sourceUri.startsWith('file://')) {
    return undefined;
  }
  const separator = sourceUri.lastIndexOf('/');
  return separator <= 'file://'.length
    ? undefined
    : `${sourceUri.slice(0, separator + 1)}${THUMBNAIL_NAME}`;
}
