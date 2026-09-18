export interface ReaderCapabilities {
  readonly tableOfContents: boolean;
  readonly continuousScroll: boolean;
  readonly readingThemeCustomization: boolean;
  readonly fontCustomization: boolean;
  readonly layoutCustomization: boolean;
  readonly zoom: boolean;
  readonly configurableReadingDirection: boolean;
  readonly doublePage: boolean;
}

export type ReadingDirection = 'left-to-right' | 'right-to-left';

export const defaultReadingDirection: ReadingDirection = 'left-to-right';

export function isReadingDirection(value: unknown): value is ReadingDirection {
  return value === 'left-to-right' || value === 'right-to-left';
}
