import { err, ok, type Result } from '../../domain';

import { normalizeBookMetadataText } from './book-metadata-extractor';
import type {
  CbrArchiveExtractionError,
  CbrArchiveExtractor,
} from './cbr-archive-extractor';
import type { ImageDirectoryImportPipeline } from './import-image-directory';
import type { ImportFormatDetector } from './import-format-detector';
import type { FileImportSource, ImportError, Importer } from './importer';

const FALLBACK_CBR_TITLE = 'Ouvrage CBR';

export interface CbrImporterDependencies {
  readonly archives: CbrArchiveExtractor;
  readonly detector: ImportFormatDetector;
  readonly images: ImageDirectoryImportPipeline;
  readonly createExtractionId: () => string;
}

export function createCbrImporter(
  dependencies: CbrImporterDependencies,
): Importer<'cbr'> {
  return {
    format: 'cbr',
    async importBook(source) {
      const detected = await detectCbr(dependencies.detector, source);
      if (!detected.ok) {
        return err(detected.error);
      }
      if (detected.value !== 'cbr') {
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
      let imported: Awaited<ReturnType<Importer<'cbr'>['importBook']>>;
      try {
        const title = normalizeBookMetadataText(source.title);
        imported = await dependencies.images.importDirectory(
          {
            kind: 'directory',
            uri: extracted.value.uri,
            name: defaultCbrTitle(source.name),
            ...(title === undefined ? {} : { title }),
          },
          {
            format: 'cbr',
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

export function defaultCbrTitle(name: string): string {
  const trimmed = name.trim();
  const withoutExtension = trimmed.toLowerCase().endsWith('.cbr')
    ? trimmed.slice(0, -4).trim()
    : trimmed;
  return normalizeBookMetadataText(withoutExtension) ?? FALLBACK_CBR_TITLE;
}

function createExtractionId(createId: () => string): string | undefined {
  try {
    const id = `cbr-${createId()}`;
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

async function detectCbr(
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
  archives: CbrArchiveExtractor,
  source: FileImportSource,
  extractionId: string,
): ReturnType<CbrArchiveExtractor['extract']> {
  try {
    return await archives.extract(source, extractionId);
  } catch {
    return err({ kind: 'filesystem-failure', operation: 'extract' });
  }
}

async function cleanupArchive(
  archives: CbrArchiveExtractor,
  extractionId: string,
): ReturnType<CbrArchiveExtractor['cleanup']> {
  try {
    return await archives.cleanup(extractionId);
  } catch {
    return err({ kind: 'filesystem-failure', operation: 'cleanup' });
  }
}

async function cleanupAfterFailure(
  archives: CbrArchiveExtractor,
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
  error: CbrArchiveExtractionError,
): ImportError {
  switch (error.kind) {
    case 'corrupted-archive':
      return { kind: 'corrupted-source', format: 'cbr' };
    case 'encrypted-archive':
      return { kind: 'archive-rejected', format: 'cbr', reason: 'encrypted' };
    case 'multi-volume-archive':
      return { kind: 'archive-rejected', format: 'cbr', reason: 'multi-volume' };
    case 'limits-exceeded':
      return {
        kind: 'archive-rejected',
        format: 'cbr',
        reason: 'limits-exceeded',
      };
    case 'unsafe-archive':
      return {
        kind: 'archive-rejected',
        format: 'cbr',
        reason: 'unsafe-contents',
      };
    case 'permission-or-access-failure':
      return { kind: 'permission-or-access-failure', source };
    case 'filesystem-failure':
      return { kind: 'filesystem-failure', operation: error.operation };
  }
}
