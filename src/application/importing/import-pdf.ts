import type { Importer } from './importer';
import {
  createFileBookImporter,
  type FileBookImporterDependencies,
} from './import-file-book';

export type PdfImporterDependencies = FileBookImporterDependencies<'pdf'>;

export function createPdfImporter(
  dependencies: PdfImporterDependencies,
): Importer<'pdf'> {
  return createFileBookImporter(
    {
      format: 'pdf',
      readerFormat: 'pdf',
      storedFileName: 'book.pdf',
      sourceExtension: '.pdf',
      fallbackTitle: 'Ouvrage PDF',
    },
    dependencies,
  );
}
