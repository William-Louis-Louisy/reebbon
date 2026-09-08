import type { Result } from '../../domain';

export interface PdfPageThumbnail {
  readonly page: number;
  readonly uri: string;
  readonly width: number;
  readonly height: number;
}

export type PdfPageThumbnailError =
  | { readonly kind: 'not-open' }
  | { readonly kind: 'invalid-page'; readonly page: number }
  | { readonly kind: 'thumbnail-source-failure' }
  | { readonly kind: 'thumbnail-rendering-failure' }
  | { readonly kind: 'thumbnail-cleanup-failure' };

export interface PdfPageThumbnailProvider {
  open(
    sourceUri: string,
    expectedPageCount: number,
  ): Promise<Result<void, PdfPageThumbnailError>>;
  render(
    page: number,
  ): Promise<Result<PdfPageThumbnail, PdfPageThumbnailError>>;
  close(): Promise<Result<void, PdfPageThumbnailError>>;
}

export type PdfPageThumbnailProviderFactory = () => PdfPageThumbnailProvider;
