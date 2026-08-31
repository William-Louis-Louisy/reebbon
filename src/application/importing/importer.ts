import type { Book, BookFormat, Result } from '../../domain';

export type ImportFormat = 'epub' | 'pdf' | 'image-directory' | 'cbz';

export interface FileImportSource {
  readonly kind: 'file';
  readonly uri: string;
  readonly name: string;
  readonly mimeType?: string;
}

export interface DirectoryImportSource {
  readonly kind: 'directory';
  readonly uri: string;
  readonly name: string;
}

export type ImportSource = FileImportSource | DirectoryImportSource;

export type ImportSourceFor<F extends ImportFormat> = F extends 'image-directory'
  ? DirectoryImportSource
  : FileImportSource;

export type ReaderFormatForImport<F extends ImportFormat> = F extends 'epub'
  ? 'epub'
  : F extends 'pdf'
    ? 'pdf'
    : 'images';

export type ImportError =
  | { readonly kind: 'unsupported-format'; readonly detectedFormat?: string }
  | { readonly kind: 'corrupted-source'; readonly format?: ImportFormat }
  | { readonly kind: 'permission-or-access-failure'; readonly source: ImportSource }
  | {
      readonly kind: 'filesystem-failure';
      readonly operation: 'stage' | 'copy' | 'extract' | 'cleanup';
    }
  | { readonly kind: 'metadata-extraction-failure'; readonly format: ImportFormat }
  | { readonly kind: 'persistence-failure'; readonly operation: 'save' | 'rollback' };

export interface ImportResult<F extends ImportFormat = ImportFormat> {
  readonly book: Book<ReaderFormatForImport<F>>;
}

export interface Importer<F extends ImportFormat = ImportFormat> {
  readonly format: F;
  importBook(source: ImportSourceFor<F>): Promise<Result<ImportResult<F>, ImportError>>;
}

export function readerFormatForImportFormat(format: ImportFormat): BookFormat {
  switch (format) {
    case 'epub':
      return 'epub';
    case 'pdf':
      return 'pdf';
    case 'image-directory':
    case 'cbz':
      return 'images';
  }
}
