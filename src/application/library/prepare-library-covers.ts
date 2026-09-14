import type { BookId, Result } from '../../domain';

import type { LibraryBookItem } from './list-library-books';

export interface PreparedLibraryCover {
  readonly uri: string;
}

export interface LibraryCoverThumbnailError {
  readonly kind: 'thumbnail-unavailable';
}

export interface LibraryCoverThumbnailProvider {
  prepare(
    bookId: BookId,
    sourceUri: string,
  ): Promise<Result<PreparedLibraryCover, LibraryCoverThumbnailError>>;
}

export async function prepareLibraryCovers(
  items: readonly LibraryBookItem[],
  provider: LibraryCoverThumbnailProvider,
): Promise<readonly LibraryBookItem[]> {
  const prepared: LibraryBookItem[] = [];

  // Sequential preparation keeps native decode peaks independent of library size.
  for (const item of items) {
    const sourceUri = item.book.coverUri;
    if (sourceUri === undefined) {
      prepared.push(item);
      continue;
    }

    let cover: Awaited<ReturnType<LibraryCoverThumbnailProvider['prepare']>>;
    try {
      cover = await provider.prepare(item.book.id, sourceUri);
    } catch {
      cover = { ok: false, error: { kind: 'thumbnail-unavailable' } };
    }

    const { coverUri: _coverUri, ...bookWithoutCover } = item.book;
    prepared.push({
      ...item,
      book: cover.ok
        ? { ...bookWithoutCover, coverUri: cover.value.uri }
        : bookWithoutCover,
    });
  }

  return prepared;
}
