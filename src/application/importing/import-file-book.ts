import { err, ok, type Book, type Result } from '../../domain';

import type { BookRepository } from '../library/book-repository';
import type { BookContentStore } from '../storage/book-content-store';
import type {
  BookMetadataExtractor,
  ExtractedBookMetadata,
  ExtractedCoverMediaType,
  MetadataExtractionError,
} from './book-metadata-extractor';
import { normalizeBookMetadataText } from './book-metadata-extractor';
import type {
  FormatDetectionError,
  ImportFormatDetector,
} from './import-format-detector';
import type {
  FileImportSource,
  ImportFormat,
  Importer,
  ReaderFormatForImport,
} from './importer';
import {
  callImportStorage,
  executeImportTransaction,
  storageErrorForImport,
} from './import-transaction';

export type FileBookImportFormat = 'epub' | 'pdf';

export interface FileBookImporterDependencies<F extends FileBookImportFormat> {
  readonly books: Pick<BookRepository, 'save' | 'delete'>;
  readonly content: BookContentStore;
  readonly detector: ImportFormatDetector;
  readonly metadata: BookMetadataExtractor<F>;
  readonly createId: () => string;
  readonly now: () => Date;
}

export interface FileBookImporterConfiguration<F extends FileBookImportFormat> {
  readonly format: F;
  readonly readerFormat: ReaderFormatForImport<F>;
  readonly storedFileName: string;
  readonly sourceExtension: `.${string}`;
  readonly fallbackTitle: string;
}

export function createFileBookImporter<F extends FileBookImportFormat>(
  configuration: FileBookImporterConfiguration<F>,
  dependencies: FileBookImporterDependencies<F>,
): Importer<F> {
  return {
    format: configuration.format,
    async importBook(source) {
      const detected = await callDetector(dependencies.detector, source);
      if (!detected.ok) {
        return err(detected.error);
      }
      if (detected.value !== configuration.format) {
        return err({ kind: 'unsupported-format', detectedFormat: detected.value });
      }

      const extracted = await callMetadataExtractor(
        dependencies.metadata,
        source,
        configuration.format,
      );
      if (!extracted.ok) {
        return err(extracted.error);
      }

      return executeImportTransaction<F>(
        source,
        dependencies,
        async (importId) => {
          const stagedFile = await callImportStorage(
            () =>
              dependencies.content.stageFile(
                importId,
                source.uri,
                configuration.storedFileName,
              ),
            'stage-file',
          );
          if (!stagedFile.ok) {
            return err(storageErrorForImport(source, stagedFile.error, 'copy'));
          }

          const extractedCover = extracted.value.cover;
          let coverFileName: string | undefined;
          if (extractedCover !== undefined) {
            const stagedCoverFileName = fileNameForCover(extractedCover.mediaType);
            coverFileName = stagedCoverFileName;
            const stagedCover = await callImportStorage(
              () =>
                dependencies.content.stageBytes(
                  importId,
                  extractedCover.bytes,
                  stagedCoverFileName,
                ),
              'stage-bytes',
            );
            if (!stagedCover.ok) {
              return err(storageErrorForImport(source, stagedCover.error, 'copy'));
            }
          }

          return ok({
            createBook: (
              bookId: string,
              contentUri: string,
              createdAt: Date,
            ) =>
              createBook(
                configuration,
                source,
                extracted.value,
                bookId,
                contentUri,
                coverFileName,
                createdAt,
              ),
          });
        },
      );
    },
  };
}

function createBook<F extends FileBookImportFormat>(
  configuration: FileBookImporterConfiguration<F>,
  source: FileImportSource,
  metadata: ExtractedBookMetadata,
  bookId: string,
  contentUri: string,
  coverFileName: string | undefined,
  createdAt: Date,
): Book<ReaderFormatForImport<F>> {
  const author = normalizeBookMetadataText(metadata.author);
  const totalPages = normalizeTotalPages(metadata.totalPages);
  return {
    id: bookId,
    title:
      normalizeBookMetadataText(metadata.title) ??
      titleFromName(
        source.name,
        configuration.sourceExtension,
        configuration.fallbackTitle,
      ),
    ...(author === undefined ? {} : { author }),
    format: configuration.readerFormat,
    fileUri: joinUri(contentUri, configuration.storedFileName),
    ...(coverFileName === undefined
      ? {}
      : { coverUri: joinUri(contentUri, coverFileName) }),
    ...(totalPages === undefined ? {} : { totalPages }),
    createdAt,
  };
}

function normalizeTotalPages(value: number | undefined): number | undefined {
  return value !== undefined && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

function titleFromName(
  name: string,
  extension: string,
  fallbackTitle: string,
): string {
  const trimmed = name.trim();
  const title = trimmed.toLowerCase().endsWith(extension.toLowerCase())
    ? trimmed.slice(0, -extension.length).trim()
    : trimmed;
  return normalizeBookMetadataText(title) ?? fallbackTitle;
}

function fileNameForCover(mediaType: ExtractedCoverMediaType): string {
  switch (mediaType) {
    case 'image/gif':
      return 'cover.gif';
    case 'image/jpeg':
      return 'cover.jpg';
    case 'image/png':
      return 'cover.png';
    case 'image/svg+xml':
      return 'cover.svg';
    case 'image/webp':
      return 'cover.webp';
  }
}

async function callDetector(
  detector: ImportFormatDetector,
  source: FileImportSource,
): Promise<Result<ImportFormat, FormatDetectionError>> {
  try {
    return await detector.detect(source);
  } catch {
    return err({ kind: 'permission-or-access-failure', source });
  }
}

async function callMetadataExtractor<F extends FileBookImportFormat>(
  extractor: BookMetadataExtractor<F>,
  source: FileImportSource,
  format: F,
): Promise<Result<ExtractedBookMetadata, MetadataExtractionError>> {
  try {
    return await extractor.extract(source);
  } catch {
    return err({ kind: 'metadata-extraction-failure', format });
  }
}

function joinUri(root: string, name: string): string {
  return `${root.replace(/\/+$/, '')}/${name}`;
}
