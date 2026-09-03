export interface ReaderCapabilities {
  readonly tableOfContents: boolean;
  readonly continuousScroll: boolean;
  readonly fontCustomization: boolean;
  readonly layoutCustomization: boolean;
  readonly zoom: boolean;
  readonly configurableReadingDirection: boolean;
  readonly doublePage: boolean;
}

export type ReadingDirection = 'left-to-right' | 'right-to-left';
