export type { Book, BookFormat, BookId } from './books/book';
export type { Bookmark, BookmarkId, BookmarkRecord } from './reading/bookmark';
export type { ReaderCapabilities, ReadingDirection } from './reading/reader-capabilities';
export {
  defaultReaderFontSize,
  isReaderFontSize,
  parseReaderFontSize,
  readerFontSizeRange,
  stepReaderFontSize,
  type InvalidReaderFontSizeError,
  type ReaderFontSize,
} from './reading/reader-font-size';
export {
  isValidEpubCfi,
  parseReaderPosition,
  type EpubReaderPosition,
  type ImageReaderPosition,
  type InvalidReaderPositionError,
  type InvalidReaderPositionReason,
  type PdfReaderPosition,
  type ReaderPosition,
  type ReaderPositionFor,
} from './reading/reader-position';
export type { ReadingProgress, ReadingProgressRecord } from './reading/reading-progress';
export type { ReadingTheme } from './reading/reading-theme';
export { err, ok, type Failure, type Result, type Success } from './shared/result';
