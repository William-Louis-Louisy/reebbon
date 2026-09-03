import type {
  Book,
  BookFormat,
  ReaderCapabilities,
  ReaderPosition,
  ReaderPositionFor,
  ReaderFontSize,
  ReaderHorizontalMargin,
  ReaderLineSpacing,
  ReadingTheme,
  Result,
} from '../../domain';

export interface ReaderProgress<F extends BookFormat> {
  readonly position: ReaderPositionFor<F>;
  /** Normalized completion ratio in the inclusive [0, 1] range. */
  readonly completionRatio: number;
}

export interface ReaderTableOfContentsEntry {
  readonly id: string;
  readonly label: string;
  readonly depth: number;
}

export interface ReaderTableOfContents {
  getEntries(): Promise<
    Result<readonly ReaderTableOfContentsEntry[], ReaderError>
  >;
  goToEntry(entryId: string): Promise<Result<void, ReaderError>>;
}

export interface ReaderFontCustomization {
  setFontSize(fontSize: ReaderFontSize): Promise<Result<void, ReaderError>>;
}

export interface ReaderLayoutCustomization {
  setHorizontalMargin(
    margin: ReaderHorizontalMargin,
  ): Promise<Result<void, ReaderError>>;
  setLineSpacing(
    lineSpacing: ReaderLineSpacing,
  ): Promise<Result<void, ReaderError>>;
}

export type ReaderError =
  | { readonly kind: 'not-open' }
  | {
      readonly kind: 'format-mismatch';
      readonly expected: BookFormat;
      readonly actual: BookFormat;
    }
  | { readonly kind: 'invalid-position'; readonly position: ReaderPosition }
  | {
      readonly kind: 'invalid-table-of-contents-entry';
      readonly entryId: string;
    }
  | { readonly kind: 'invalid-font-size'; readonly fontSize: number }
  | {
      readonly kind: 'invalid-horizontal-margin';
      readonly margin: number;
    }
  | {
      readonly kind: 'invalid-line-spacing';
      readonly lineSpacing: number;
    }
  | { readonly kind: 'content-access-failure' }
  | { readonly kind: 'rendering-failure' };

interface ReaderBase<F extends BookFormat> {
  readonly format: F;
  readonly capabilities: ReaderCapabilities;
  readonly tableOfContents?: ReaderTableOfContents;

  open(
    book: Book<F>,
    initialPosition?: ReaderPositionFor<F>,
  ): Promise<Result<void, ReaderError>>;
  goTo(position: ReaderPositionFor<F>): Promise<Result<void, ReaderError>>;
  getProgress(): Promise<Result<ReaderProgress<F>, ReaderError>>;
  setTheme(theme: ReadingTheme): Promise<Result<void, ReaderError>>;
  close(): Promise<Result<void, ReaderError>>;
}

type ReaderFontCustomizationSupport =
  | {
      readonly capabilities: ReaderCapabilities & {
        readonly fontCustomization: true;
      };
      readonly fontCustomization: ReaderFontCustomization;
    }
  | {
      readonly capabilities: ReaderCapabilities & {
        readonly fontCustomization: false;
      };
      readonly fontCustomization?: never;
    };

type ReaderLayoutCustomizationSupport =
  | {
      readonly capabilities: ReaderCapabilities & {
        readonly layoutCustomization: true;
      };
      readonly layoutCustomization: ReaderLayoutCustomization;
    }
  | {
      readonly capabilities: ReaderCapabilities & {
        readonly layoutCustomization: false;
      };
      readonly layoutCustomization?: never;
    };

export type Reader<F extends BookFormat = BookFormat> = ReaderBase<F> &
  ReaderFontCustomizationSupport &
  ReaderLayoutCustomizationSupport;
