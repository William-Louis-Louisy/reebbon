import type { Book, BookId, Result } from '../../domain';

import type { RepositoryError } from '../shared/repository-error';

export interface BookRepository {
  getById(id: BookId): Promise<Result<Book | null, RepositoryError>>;
  list(): Promise<Result<readonly Book[], RepositoryError>>;
  save(book: Book): Promise<Result<void, RepositoryError>>;
  delete(id: BookId): Promise<Result<void, RepositoryError>>;
}
