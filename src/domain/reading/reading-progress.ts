import type { BookFormat, BookId } from '../books/book';
import type { ReaderPositionFor } from './reader-position';

export interface ReadingProgressRecord<F extends BookFormat> {
  readonly bookId: BookId;
  readonly position: ReaderPositionFor<F>;
  /** Normalized completion ratio in the inclusive [0, 1] range. */
  readonly completionRatio: number;
  readonly updatedAt: Date;
}

export type ReadingProgress = {
  readonly [F in BookFormat]: ReadingProgressRecord<F>;
}[BookFormat];
