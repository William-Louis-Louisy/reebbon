import { err, ok, type Book, type Result } from '../../domain';

import type { BookRepository } from '../library/book-repository';
import type { BookContentStore } from '../storage/book-content-store';
import { normalizeBookMetadataText } from './book-metadata-extractor';
import type { ImportDirectoryEntry, ImportDirectoryReader } from './import-directory-reader';
import type { ImportFileReader } from './import-file-reader';
import type { ImportFormatDetector } from './import-format-detector';
import type {
  DirectoryImportSource,
  ImportError,
  ImportFormat,
  ImportResult,
  ImportSourceFor,
  Importer,
  ReaderFormatForImport,
} from './importer';
import {
  callImportStorage,
  executeImportTransaction,
  storageErrorForImport,
} from './import-transaction';

const IMAGE_SIGNATURE_BYTE_LENGTH = 8;
const FALLBACK_IMAGE_BOOK_TITLE = 'Ouvrage images';

type ImageMediaType = 'image/jpeg' | 'image/png';
type ImageImportFormat = Extract<ImportFormat, 'image-directory' | 'cbz'>;

interface ImagePageSource {
  readonly uri: string;
  readonly name: string;
  readonly mediaType: ImageMediaType;
}

interface StagedImagePage extends ImagePageSource {
  readonly storedName: string;
}

export interface ImageDirectoryImporterDependencies {
  readonly books: Pick<BookRepository, 'save' | 'delete'>;
  readonly content: BookContentStore;
  readonly detector: ImportFormatDetector;
  readonly directories: ImportDirectoryReader;
  readonly files: Pick<ImportFileReader, 'readPrefix'>;
  readonly createId: () => string;
  readonly now: () => Date;
}

export interface ImageDirectoryImportContext<F extends ImageImportFormat> {
  readonly format: F;
  readonly source: ImportSourceFor<F>;
  readonly afterStaging?: () => Promise<Result<void, ImportError>>;
}

export interface ImageDirectoryImportPipeline {
  importDirectory<F extends ImageImportFormat>(
    source: DirectoryImportSource,
    context: ImageDirectoryImportContext<F>,
  ): Promise<Result<ImportResult<F>, ImportError>>;
}

export function createImageDirectoryImporter(
  dependencies: ImageDirectoryImporterDependencies,
): Importer<'image-directory'> {
  const pipeline = createImageDirectoryImportPipeline(dependencies);
  return {
    format: 'image-directory',
    importBook(source) {
      return pipeline.importDirectory(source, {
        format: 'image-directory',
        source,
      });
    },
  };
}

export function createImageDirectoryImportPipeline(
  dependencies: ImageDirectoryImporterDependencies,
): ImageDirectoryImportPipeline {
  return {
    async importDirectory(source, context) {
      const detected = await detectDirectory(dependencies.detector, source);
      if (!detected.ok) {
        return err(errorForImageContext(detected.error, context));
      }
      if (detected.value !== 'image-directory') {
        return err({ kind: 'unsupported-format', detectedFormat: detected.value });
      }

      const listed = await listDirectory(dependencies.directories, source);
      if (!listed.ok) {
        return err({ kind: 'permission-or-access-failure', source: context.source });
      }

      const pages = selectImagePages(listed.value);
      if (pages.length === 0) {
        return err({ kind: 'corrupted-source', format: context.format });
      }

      const validated = await validateImagePages(
        dependencies.files,
        pages,
        context,
      );
      if (!validated.ok) {
        return err(validated.error);
      }

      const title =
        normalizeBookMetadataText(source.title) ??
        normalizeBookMetadataText(source.name) ??
        FALLBACK_IMAGE_BOOK_TITLE;

      return executeImportTransaction(
        context.source,
        dependencies,
        async (importId) => {
          const stagedPages: StagedImagePage[] = [];
          for (const [index, page] of validated.value.entries()) {
            const storedName = storedImageName(index, page.mediaType);
            const staged = await callImportStorage(
              () =>
                dependencies.content.stageFile(
                  importId,
                  page.uri,
                  storedName,
                ),
              'stage-file',
            );
            if (!staged.ok) {
              return err(
                storageErrorForImport(context.source, staged.error, 'copy'),
              );
            }
            stagedPages.push({ ...page, storedName });
          }

          const coverName = stagedPages[0]?.storedName;
          if (coverName === undefined) {
            return err({ kind: 'corrupted-source', format: context.format });
          }

          if (context.afterStaging !== undefined) {
            const finalized = await callAfterStaging(context.afterStaging);
            if (!finalized.ok) {
              return err(finalized.error);
            }
          }

          return ok({
            createBook: (
              bookId: string,
              contentUri: string,
              createdAt: Date,
            ): Book<ReaderFormatForImport<typeof context.format>> =>
              ({
                id: bookId,
                title,
                format: 'images',
                fileUri: contentUri,
                coverUri: joinUri(contentUri, coverName),
                totalPages: stagedPages.length,
                createdAt,
              }) as Book<ReaderFormatForImport<typeof context.format>>,
          });
        },
      );
    },
  };
}

export function compareNaturalFileNames(left: string, right: string): number {
  const leftTokens = tokenizeNaturalName(left);
  const rightTokens = tokenizeNaturalName(right);
  const tokenCount = Math.min(leftTokens.length, rightTokens.length);

  for (let index = 0; index < tokenCount; index += 1) {
    const leftToken = leftTokens[index];
    const rightToken = rightTokens[index];
    if (leftToken === undefined || rightToken === undefined) {
      break;
    }

    const compared = compareNaturalToken(leftToken, rightToken);
    if (compared !== 0) {
      return compared;
    }
  }

  if (leftTokens.length !== rightTokens.length) {
    return leftTokens.length - rightTokens.length;
  }

  return compareText(left.toLowerCase(), right.toLowerCase()) || compareText(left, right);
}

function selectImagePages(entries: readonly ImportDirectoryEntry[]): ImagePageSource[] {
  return entries
    .flatMap((entry): ImagePageSource[] => {
      const mediaType =
        entry.kind === 'file' ? imageMediaTypeFromName(entry.name) : undefined;
      return mediaType === undefined || entry.uri.trim().length === 0
        ? []
        : [{ uri: entry.uri, name: entry.name, mediaType }];
    })
    .sort(
      (left, right) =>
        compareNaturalFileNames(left.name, right.name) ||
        compareText(left.uri, right.uri),
    );
}

async function validateImagePages(
  files: Pick<ImportFileReader, 'readPrefix'>,
  pages: readonly ImagePageSource[],
  context: ImageDirectoryImportContext<ImageImportFormat>,
): Promise<Result<readonly ImagePageSource[], ImportError>> {
  for (const page of pages) {
    let prefix: Awaited<ReturnType<ImportFileReader['readPrefix']>>;
    try {
      prefix = await files.readPrefix(page.uri, IMAGE_SIGNATURE_BYTE_LENGTH);
    } catch {
      return err({ kind: 'permission-or-access-failure', source: context.source });
    }
    if (!prefix.ok) {
      return err({ kind: 'permission-or-access-failure', source: context.source });
    }
    if (!imageSignatureMatches(page.mediaType, prefix.value)) {
      return err({ kind: 'corrupted-source', format: context.format });
    }
  }

  return ok(pages);
}

async function callAfterStaging(
  afterStaging: () => Promise<Result<void, ImportError>>,
): Promise<Result<void, ImportError>> {
  try {
    return await afterStaging();
  } catch {
    return err({ kind: 'filesystem-failure', operation: 'cleanup' });
  }
}

function errorForImageContext<F extends ImageImportFormat>(
  error: ImportError,
  context: ImageDirectoryImportContext<F>,
): ImportError {
  switch (error.kind) {
    case 'corrupted-source':
      return { kind: 'corrupted-source', format: context.format };
    case 'permission-or-access-failure':
      return { kind: 'permission-or-access-failure', source: context.source };
    default:
      return error;
  }
}

async function detectDirectory(
  detector: ImportFormatDetector,
  source: DirectoryImportSource,
): Promise<Awaited<ReturnType<ImportFormatDetector['detect']>>> {
  try {
    return await detector.detect(source);
  } catch {
    return err({ kind: 'permission-or-access-failure', source });
  }
}

async function listDirectory(
  directories: ImportDirectoryReader,
  source: DirectoryImportSource,
): Promise<Awaited<ReturnType<ImportDirectoryReader['list']>>> {
  try {
    return await directories.list(source);
  } catch {
    return err({ kind: 'permission-or-access-failure' });
  }
}

function imageMediaTypeFromName(name: string): ImageMediaType | undefined {
  const extension = /\.([^.]+)$/.exec(name.trim())?.[1]?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    default:
      return undefined;
  }
}

function imageSignatureMatches(mediaType: ImageMediaType, bytes: Uint8Array): boolean {
  switch (mediaType) {
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return (
    bytes.byteLength >= signature.length &&
    signature.every((value, index) => bytes[index] === value)
  );
}

function storedImageName(index: number, mediaType: ImageMediaType): string {
  const sequence = String(index + 1).padStart(6, '0');
  return `page-${sequence}.${mediaType === 'image/png' ? 'png' : 'jpg'}`;
}

function tokenizeNaturalName(value: string): readonly string[] {
  return value.match(/\d+|\D+/g) ?? [value];
}

function compareNaturalToken(left: string, right: string): number {
  const leftIsNumber = /^\d+$/.test(left);
  const rightIsNumber = /^\d+$/.test(right);
  if (leftIsNumber && rightIsNumber) {
    const normalizedLeft = left.replace(/^0+(?=\d)/, '');
    const normalizedRight = right.replace(/^0+(?=\d)/, '');
    return (
      normalizedLeft.length - normalizedRight.length ||
      compareText(normalizedLeft, normalizedRight)
    );
  }
  if (leftIsNumber !== rightIsNumber) {
    return leftIsNumber ? -1 : 1;
  }
  return compareText(left.toLowerCase(), right.toLowerCase());
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function joinUri(root: string, name: string): string {
  return `${root.replace(/\/+$/, '')}/${name}`;
}
