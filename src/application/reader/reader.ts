import type {
  Book,
  BookFormat,
  ReaderCapabilities,
  ReaderPosition,
  ReaderPositionFor,
  ReadingTheme,
  Result,
} from '../../domain';

export interface ReaderProgress<F extends BookFormat> {
  readonly position: ReaderPositionFor<F>;
  /** Normalized completion ratio in the inclusive [0, 1] range. */
  readonly completionRatio: number;
}

export type ReaderError =
  | { readonly kind: 'not-open' }
  | {
      readonly kind: 'format-mismatch';
      readonly expected: BookFormat;
      readonly actual: BookFormat;
    }
  | { readonly kind: 'invalid-position'; readonly position: ReaderPosition }
  | { readonly kind: 'content-access-failure' }
  | { readonly kind: 'rendering-failure' };

export interface Reader<F extends BookFormat = BookFormat> {
  readonly format: F;
  readonly capabilities: ReaderCapabilities;

  open(
    book: Book<F>,
    initialPosition?: ReaderPositionFor<F>,
  ): Promise<Result<void, ReaderError>>;
  goTo(position: ReaderPositionFor<F>): Promise<Result<void, ReaderError>>;
  getProgress(): Promise<Result<ReaderProgress<F>, ReaderError>>;
  setTheme(theme: ReadingTheme): Promise<Result<void, ReaderError>>;
  close(): Promise<Result<void, ReaderError>>;
}
