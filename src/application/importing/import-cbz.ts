import { err, ok, type Result } from '../../domain';

import type { CbzArchiveExtractor, CbzArchiveExtractionError } from './cbz-archive-extractor';
import { normalizeBookMetadataText } from './book-metadata-extractor';
import type { ImageDirectoryImportPipeline } from './import-image-directory';
import type { ImportFormatDetector } from './import-format-detector';
import type {
  FileImportSource,
  ImportError,
  Importer,
} from './importer';

const FALLBACK_CBZ_TITLE = 'Ouvrage CBZ';

export interface CbzImporterDependencies {
  readonly archives: CbzArchiveExtractor;
  readonly detector: ImportFormatDetector;
  readonly images: ImageDirectoryImportPipeline;
  readonly createExtractionId: () => string;
}

export function createCbzImporter(
  dependencies: CbzImporterDependencies,
): Importer<'cbz'> {
  return {
    format: 'cbz',
    async importBook(source) {
      const detected = await detectCbz(dependencies.detector, source);
      if (!detected.ok) {
        return err(detected.error);
      }
      if (detected.value !== 'cbz') {
        return err({ kind: 'unsupported-format', detectedFormat: detected.value });
      }

      const extractionId = createExtractionId(dependencies.createExtractionId);
      if (extractionId === undefined) {
        return err({ kind: 'filesystem-failure', operation: 'extract' });
      }

      const extracted = await extractArchive(
        dependencies.archives,
        source,
        extractionId,
      );
      if (!extracted.ok) {
        return cleanupAfterFailure(
          dependencies.archives,
          extractionId,
          extractionErrorForImport(source, extracted.error),
        );
      }

      let cleanupPending = true;
      let imported: Awaited<ReturnType<Importer<'cbz'>['importBook']>>;
      try {
        const title = normalizeBookMetadataText(source.title);
        imported = await dependencies.images.importDirectory(
          {
            kind: 'directory',
            uri: extracted.value.uri,
            name: defaultCbzTitle(source.name),
            ...(title === undefined ? {} : { title }),
          },
          {
            format: 'cbz',
            source,
            afterStaging: async () => {
              const cleaned = await cleanupArchive(
                dependencies.archives,
                extractionId,
              );
              if (!cleaned.ok) {
                return err({ kind: 'filesystem-failure', operation: 'cleanup' });
              }
              cleanupPending = false;
              return ok(undefined);
            },
          },
        );
      } catch {
        imported = err({ kind: 'filesystem-failure', operation: 'stage' });
      }

      if (cleanupPending) {
        const cleaned = await cleanupArchive(dependencies.archives, extractionId);
        if (!cleaned.ok) {
          return err({ kind: 'filesystem-failure', operation: 'cleanup' });
        }
      }

      return imported;
    },
  };
}

export function defaultCbzTitle(name: string): string {
  const trimmed = name.trim();
  const withoutExtension = trimmed.toLowerCase().endsWith('.cbz')
    ? trimmed.slice(0, -4).trim()
    : trimmed;
  return normalizeBookMetadataText(withoutExtension) ?? FALLBACK_CBZ_TITLE;
}

function createExtractionId(createId: () => string): string | undefined {
  try {
    const id = `cbz-${createId()}`;
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

async function detectCbz(
  detector: ImportFormatDetector,
  source: FileImportSource,
): Promise<Awaited<ReturnType<ImportFormatDetector['detect']>>> {
  try {
    return await detector.detect(source);
  } catch {
    return err({ kind: 'permission-or-access-failure', source });
  }
}

async function extractArchive(
  archives: CbzArchiveExtractor,
  source: FileImportSource,
  extractionId: string,
): ReturnType<CbzArchiveExtractor['extract']> {
  try {
    return await archives.extract(source, extractionId);
  } catch {
    return err({ kind: 'filesystem-failure', operation: 'extract' });
  }
}

async function cleanupArchive(
  archives: CbzArchiveExtractor,
  extractionId: string,
): ReturnType<CbzArchiveExtractor['cleanup']> {
  try {
    return await archives.cleanup(extractionId);
  } catch {
    return err({ kind: 'filesystem-failure', operation: 'cleanup' });
  }
}

async function cleanupAfterFailure(
  archives: CbzArchiveExtractor,
  extractionId: string,
  originalError: ImportError,
): Promise<Result<never, ImportError>> {
  const cleaned = await cleanupArchive(archives, extractionId);
  return err(
    cleaned.ok
      ? originalError
      : { kind: 'filesystem-failure', operation: 'cleanup' },
  );
}

function extractionErrorForImport(
  source: FileImportSource,
  error: CbzArchiveExtractionError,
): ImportError {
  switch (error.kind) {
    case 'corrupted-archive':
      return { kind: 'corrupted-source', format: 'cbz' };
    case 'permission-or-access-failure':
      return { kind: 'permission-or-access-failure', source };
    case 'filesystem-failure':
      return { kind: 'filesystem-failure', operation: error.operation };
  }
}
