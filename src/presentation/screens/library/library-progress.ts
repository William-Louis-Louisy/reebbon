import type { LibraryBookItem } from '@/application';
import type { BookId } from '@/domain';

import { normalizeProgress } from '../../components/ribbon-metrics';

export function updateLibraryBookProgress(
  books: readonly LibraryBookItem[],
  bookId: BookId,
  progress: number,
): readonly LibraryBookItem[] {
  const index = books.findIndex((item) => item.book.id === bookId);
  if (index < 0) {
    return books;
  }

  const item = books[index];
  const normalizedProgress = normalizeProgress(progress);
  if (item === undefined || item.progress === normalizedProgress) {
    return books;
  }

  const updated = [...books];
  updated[index] = { ...item, progress: normalizedProgress };
  return updated;
}
