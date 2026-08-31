export type BookFormat = 'epub' | 'pdf' | 'images';

export type BookId = string;

export interface Book<F extends BookFormat = BookFormat> {
  readonly id: BookId;
  readonly title: string;
  readonly author?: string;
  readonly format: F;
  readonly fileUri: string;
  readonly coverUri?: string;
  readonly totalPages?: number;
  readonly createdAt: Date;
  readonly lastOpenedAt?: Date;
}
