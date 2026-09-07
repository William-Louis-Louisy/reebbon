import { PDFDocument } from 'pdf-lib';

import type {
  BookMetadataExtractor,
  ExtractedBookMetadata,
  FileImportSource,
  ImportFileReader,
  MetadataExtractionError,
} from '../../application';
import { err, ok, type Result } from '../../domain';
import type { PdfFirstPageRenderer } from './pdf-first-page-renderer';

export class PdfMetadataExtractor implements BookMetadataExtractor<'pdf'> {
  public readonly format = 'pdf' as const;

  public constructor(
    private readonly files: Pick<ImportFileReader, 'readAll'>,
    private readonly firstPage: PdfFirstPageRenderer,
  ) {}

  public async extract(
    source: FileImportSource,
  ): Promise<Result<ExtractedBookMetadata, MetadataExtractionError>> {
    const rendered = await this.firstPage.render(source);
    if (!rendered.ok) {
      return rendered;
    }

    const sourceBytes = await this.files.readAll(source.uri);
    if (!sourceBytes.ok) {
      return err({ kind: 'permission-or-access-failure', source });
    }

    const documentMetadata = await readDocumentMetadata(sourceBytes.value);
    return ok({
      ...documentMetadata,
      cover: rendered.value.cover,
      totalPages: rendered.value.totalPages,
    });
  }
}

async function readDocumentMetadata(
  bytes: Uint8Array,
): Promise<Pick<ExtractedBookMetadata, 'title' | 'author'>> {
  try {
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const title = document.getTitle();
    const author = document.getAuthor();
    return {
      ...(title === undefined ? {} : { title }),
      ...(author === undefined ? {} : { author }),
    };
  } catch {
    // Native rendering already validated the document; unreadable metadata is optional.
    return {};
  }
}
