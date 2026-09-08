import type {
  BookMetadataExtractor,
  ExtractedBookMetadata,
  FileImportSource,
  MetadataExtractionError,
} from '../../application';
import { ok, type Result } from '../../domain';
import type { PdfFirstPageRenderer } from './pdf-first-page-renderer';

export class PdfMetadataExtractor implements BookMetadataExtractor<'pdf'> {
  public readonly format = 'pdf' as const;

  public constructor(private readonly firstPage: PdfFirstPageRenderer) {}

  public async extract(
    source: FileImportSource,
  ): Promise<Result<ExtractedBookMetadata, MetadataExtractionError>> {
    const rendered = await this.firstPage.render(source);
    if (!rendered.ok) {
      return rendered;
    }

    return ok({
      cover: rendered.value.cover,
      totalPages: rendered.value.totalPages,
    });
  }
}
