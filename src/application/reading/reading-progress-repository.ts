import type { BookId, ReadingProgress, Result } from '../../domain';

import type { RepositoryError } from '../shared/repository-error';

export interface ReadingProgressRepository {
  getByBookId(bookId: BookId): Promise<Result<ReadingProgress | null, RepositoryError>>;
  save(progress: ReadingProgress): Promise<Result<void, RepositoryError>>;
  deleteByBookId(bookId: BookId): Promise<Result<void, RepositoryError>>;
}
