import type { BookId, Bookmark, BookmarkId, Result } from '../../domain';

import type { RepositoryError } from '../shared/repository-error';

export interface BookmarkRepository {
  listByBookId(bookId: BookId): Promise<Result<readonly Bookmark[], RepositoryError>>;
  save(bookmark: Bookmark): Promise<Result<void, RepositoryError>>;
  delete(id: BookmarkId): Promise<Result<void, RepositoryError>>;
  deleteByBookId(bookId: BookId): Promise<Result<void, RepositoryError>>;
}
