import type { Importer } from './importer';
import {
  createFileBookImporter,
  type FileBookImporterDependencies,
} from './import-file-book';

export type EpubImporterDependencies = FileBookImporterDependencies<'epub'>;

export function createEpubImporter(
  dependencies: EpubImporterDependencies,
): Importer<'epub'> {
  return createFileBookImporter(
    {
      format: 'epub',
      readerFormat: 'epub',
      storedFileName: 'book.epub',
      sourceExtension: '.epub',
      fallbackTitle: 'Ouvrage EPUB',
    },
    dependencies,
  );
}
