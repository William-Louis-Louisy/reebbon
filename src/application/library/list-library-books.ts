import { err, ok, type Book, type Result } from '../../domain';

import type { BookRepository } from './book-repository';
import type { ReadingProgressRepository } from '../reading/reading-progress-repository';
import type { RepositoryError } from '../shared/repository-error';

export interface LibraryBookItem {
  readonly book: Book;
  readonly progress: number;
}

export interface ListLibraryBooksDependencies {
  readonly books: Pick<BookRepository, 'list'>;
  readonly readingProgress: Pick<ReadingProgressRepository, 'getByBookId'>;
}

export type ListLibraryBooks = () => Promise<
  Result<readonly LibraryBookItem[], RepositoryError>
>;

export function createListLibraryBooks(
  dependencies: ListLibraryBooksDependencies,
): ListLibraryBooks {
  return async () => {
    const books = await dependencies.books.list();
    if (!books.ok) {
      return err(books.error);
    }

    const progressResults = await Promise.all(
      books.value.map((book) =>
        dependencies.readingProgress.getByBookId(book.id),
      ),
    );

    const items: LibraryBookItem[] = [];
    for (let index = 0; index < books.value.length; index += 1) {
      const progress = progressResults[index];
      const book = books.value[index];

      if (progress === undefined || book === undefined) {
        return err({ kind: 'persistence-failure', operation: 'read' });
      }

      if (!progress.ok) {
        return err(progress.error);
      }

      items.push({
        book,
        progress: progress.value?.completionRatio ?? 0,
      });
    }

    return ok(items);
  };
}
