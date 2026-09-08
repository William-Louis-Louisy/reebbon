import type {
  ExtractedBookCover,
  FileImportSource,
  ImportFileReader,
  MetadataExtractionError,
} from '../../application';
import { err, ok, type Result } from '../../domain';
import {
  loadNativePdfPageImageGateway,
  type PdfPageImageGateway,
  type PdfPageImageGatewayLoader,
} from '../pdf/pdf-page-image-gateway';

export type {
  PdfPageImageGateway,
  PdfPageImageGatewayLoader,
} from '../pdf/pdf-page-image-gateway';

const FIRST_PAGE_INDEX = 0;
const COVER_MAX_DIMENSION = 640;
const COVER_JPEG_QUALITY = 82;

export interface RenderedPdfFirstPage {
  readonly cover: ExtractedBookCover;
  readonly totalPages: number;
}

export interface PdfFirstPageRenderer {
  render(
    source: FileImportSource,
  ): Promise<Result<RenderedPdfFirstPage, MetadataExtractionError>>;
}

export class ExpoPdfFirstPageRenderer implements PdfFirstPageRenderer {
  public constructor(
    private readonly files: Pick<ImportFileReader, 'readAll'>,
    private readonly loadGateway: PdfPageImageGatewayLoader =
      loadNativePdfPageImageGateway,
  ) {}

  public async render(
    source: FileImportSource,
  ): Promise<Result<RenderedPdfFirstPage, MetadataExtractionError>> {
    let gateway: PdfPageImageGateway;
    try {
      gateway = await this.loadGateway();
    } catch {
      return err({ kind: 'metadata-extraction-failure', format: 'pdf' });
    }

    let pageCount: number;
    try {
      const opened = await gateway.open(source.uri);
      pageCount = opened.pageCount;
    } catch {
      return err({ kind: 'corrupted-source', format: 'pdf' });
    }

    let rendered: Result<RenderedPdfFirstPage, MetadataExtractionError>;
    if (!Number.isSafeInteger(pageCount) || pageCount <= 0) {
      rendered = err({ kind: 'corrupted-source', format: 'pdf' });
    } else {
      rendered = await this.renderOpenedDocument(gateway, source.uri, pageCount);
    }

    try {
      await gateway.close(source.uri);
    } catch {
      return err({ kind: 'metadata-extraction-failure', format: 'pdf' });
    }
    return rendered;
  }

  private async renderOpenedDocument(
    gateway: PdfPageImageGateway,
    sourceUri: string,
    pageCount: number,
  ): Promise<Result<RenderedPdfFirstPage, MetadataExtractionError>> {
    try {
      const image = await gateway.generate(sourceUri, FIRST_PAGE_INDEX, 1, {
        format: 'jpeg',
        quality: COVER_JPEG_QUALITY,
        maxDimension: COVER_MAX_DIMENSION,
      });
      if (
        image.uri.trim().length === 0 ||
        !Number.isFinite(image.width) ||
        image.width <= 0 ||
        !Number.isFinite(image.height) ||
        image.height <= 0
      ) {
        return err({ kind: 'metadata-extraction-failure', format: 'pdf' });
      }

      const imageBytes = await this.files.readAll(image.uri);
      if (!imageBytes.ok || !hasJpegSignature(imageBytes.value)) {
        return err({ kind: 'metadata-extraction-failure', format: 'pdf' });
      }

      return ok({
        cover: { bytes: imageBytes.value, mediaType: 'image/jpeg' },
        totalPages: pageCount,
      });
    } catch {
      return err({ kind: 'metadata-extraction-failure', format: 'pdf' });
    }
  }
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
