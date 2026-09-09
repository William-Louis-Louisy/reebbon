import type { Result } from '../../domain';

export interface ImageSetPage {
  readonly index: number;
  readonly uri: string;
}

export type ImageSetPageProviderError = {
  readonly kind: 'content-access-failure';
};

export interface ImageSetPageProvider {
  getPages(
    contentUri: string,
    expectedTotalPages: number,
  ): Promise<Result<readonly ImageSetPage[], ImageSetPageProviderError>>;
}
