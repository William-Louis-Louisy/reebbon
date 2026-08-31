import type { BookFormat, BookId } from '../books/book';
import type { ReaderPositionFor } from './reader-position';

export type BookmarkId = string;

export interface BookmarkRecord<F extends BookFormat> {
  readonly id: BookmarkId;
  readonly bookId: BookId;
  readonly position: ReaderPositionFor<F>;
  readonly label?: string;
  readonly createdAt: Date;
}

export type Bookmark = {
  readonly [F in BookFormat]: BookmarkRecord<F>;
}[BookFormat];
