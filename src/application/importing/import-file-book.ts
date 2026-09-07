import { err, ok, type Book, type Result } from '../../domain';

import type { BookRepository } from '../library/book-repository';
import type { RepositoryError } from '../shared/repository-error';
import type {
  BookContentStore,
  FileStorageError,
  FileStorageOperation,
} from '../storage/book-content-store';
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
  ImportError,
  ImportFormat,
  ImportResult,
  Importer,
  ReaderFormatForImport,
} from './importer';

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

interface ImportProgress {
  stagingAttempted: boolean;
  commitAttempted: boolean;
  saveAttempted: boolean;
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

      const identifiers = createIdentifiers(dependencies.createId);
      if (identifiers === null) {
        return err({ kind: 'persistence-failure', operation: 'save' });
      }

      const { bookId, importId } = identifiers;
      const progress: ImportProgress = {
        stagingAttempted: false,
        commitAttempted: false,
        saveAttempted: false,
      };
      const fail = async (error: ImportError) => {
        const cleanupError = await rollbackImport(
          dependencies,
          importId,
          bookId,
          progress,
        );
        return err(cleanupError ?? error);
      };

      progress.stagingAttempted = true;
      const staging = await callStorage(
        () => dependencies.content.createStagingArea(importId),
        'create-staging-area',
      );
      if (!staging.ok) {
        return fail(storageErrorForImport(source, staging.error, 'stage'));
      }

      const stagedFile = await callStorage(
        () =>
          dependencies.content.stageFile(
            importId,
            source.uri,
            configuration.storedFileName,
          ),
        'stage-file',
      );
      if (!stagedFile.ok) {
        return fail(storageErrorForImport(source, stagedFile.error, 'copy'));
      }

      const extractedCover = extracted.value.cover;
      let coverFileName: string | undefined;
      if (extractedCover !== undefined) {
        const stagedCoverFileName = fileNameForCover(extractedCover.mediaType);
        coverFileName = stagedCoverFileName;
        const stagedCover = await callStorage(
          () =>
            dependencies.content.stageBytes(
              importId,
              extractedCover.bytes,
              stagedCoverFileName,
            ),
          'stage-bytes',
        );
        if (!stagedCover.ok) {
          return fail(storageErrorForImport(source, stagedCover.error, 'copy'));
        }
      }

      progress.commitAttempted = true;
      const committed = await callStorage(
        () => dependencies.content.commitStagingArea(importId, bookId),
        'commit-staging-area',
      );
      if (!committed.ok) {
        return fail(storageErrorForImport(source, committed.error, 'copy'));
      }

      const book = createBook(
        configuration,
        source,
        extracted.value,
        bookId,
        committed.value.uri,
        coverFileName,
        safelyCreateDate(dependencies.now),
      );

      progress.saveAttempted = true;
      const saved = await callRepository(() => dependencies.books.save(book), 'write');
      if (!saved.ok) {
        return fail({ kind: 'persistence-failure', operation: 'save' });
      }

      return ok({ book } satisfies ImportResult<F>);
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

function createIdentifiers(
  createId: () => string,
): { readonly bookId: string; readonly importId: string } | null {
  try {
    const bookId = createId();
    const importId = `import-${createId()}`;
    return isSafeIdentifier(bookId) && isSafeIdentifier(importId)
      ? { bookId, importId }
      : null;
  } catch {
    return null;
  }
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

function safelyCreateDate(now: () => Date): Date {
  try {
    return now();
  } catch {
    return new Date(Number.NaN);
  }
}

function joinUri(root: string, name: string): string {
  return `${root.replace(/\/+$/, '')}/${name}`;
}

async function callStorage<T>(
  operation: () => Promise<Result<T, FileStorageError>>,
  fallbackOperation: FileStorageOperation,
): Promise<Result<T, FileStorageError>> {
  try {
    return await operation();
  } catch {
    return err({ kind: 'filesystem-failure', operation: fallbackOperation });
  }
}

async function callRepository(
  operation: () => Promise<Result<void, RepositoryError>>,
  fallbackOperation: RepositoryError['operation'],
): Promise<Result<void, RepositoryError>> {
  try {
    return await operation();
  } catch {
    return err({ kind: 'persistence-failure', operation: fallbackOperation });
  }
}

function storageErrorForImport(
  source: FileImportSource,
  error: FileStorageError,
  operation: 'stage' | 'copy',
): ImportError {
  return error.kind === 'permission-or-access-failure'
    ? { kind: 'permission-or-access-failure', source }
    : { kind: 'filesystem-failure', operation };
}

async function rollbackImport<F extends FileBookImportFormat>(
  dependencies: FileBookImporterDependencies<F>,
  importId: string,
  bookId: string,
  progress: ImportProgress,
): Promise<ImportError | undefined> {
  let rollbackError: ImportError | undefined;

  if (progress.saveAttempted) {
    const deleted = await callRepository(() => dependencies.books.delete(bookId), 'delete');
    if (!deleted.ok) {
      rollbackError = { kind: 'persistence-failure', operation: 'rollback' };
    }
  }

  if (progress.commitAttempted) {
    const removedBookFiles = await callStorage(
      () => dependencies.content.removeBookFiles(bookId),
      'remove-book-files',
    );
    if (!removedBookFiles.ok && rollbackError === undefined) {
      rollbackError = { kind: 'filesystem-failure', operation: 'cleanup' };
    }
  }

  if (progress.stagingAttempted) {
    const removedStaging = await callStorage(
      () => dependencies.content.removeStagingArea(importId),
      'remove-staging-area',
    );
    if (!removedStaging.ok && rollbackError === undefined) {
      rollbackError = { kind: 'filesystem-failure', operation: 'cleanup' };
    }
  }

  return rollbackError;
}
