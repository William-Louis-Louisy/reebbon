import type {
  PdfPageThumbnail,
  PdfPageThumbnailError,
  PdfPageThumbnailProvider,
} from '../../application';
import { err, ok, type Result } from '../../domain';
import {
  loadNativePdfPageImageGateway,
  type PdfPageImageGateway,
  type PdfPageImageGatewayLoader,
} from '../pdf/pdf-page-image-gateway';

const THUMBNAIL_SCALE = 1;
const THUMBNAIL_MAX_DIMENSION = 320;
const THUMBNAIL_JPEG_QUALITY = 76;

interface OpenPdfThumbnailSession {
  readonly gateway: PdfPageImageGateway;
  readonly sourceUri: string;
  readonly pageCount: number;
}

export class NativePdfPageThumbnailProvider
  implements PdfPageThumbnailProvider
{
  private session: OpenPdfThumbnailSession | undefined;
  private readonly activeRenders = new Set<
    Promise<Result<PdfPageThumbnail, PdfPageThumbnailError>>
  >();

  public constructor(
    private readonly loadGateway: PdfPageImageGatewayLoader =
      loadNativePdfPageImageGateway,
  ) {}

  public async open(
    sourceUri: string,
    expectedPageCount: number,
  ): Promise<Result<void, PdfPageThumbnailError>> {
    if (
      sourceUri.trim().length === 0 ||
      !Number.isSafeInteger(expectedPageCount) ||
      expectedPageCount < 1
    ) {
      return err({ kind: 'thumbnail-source-failure' });
    }

    if (this.session !== undefined) {
      const closed = await this.close();
      if (!closed.ok) {
        return closed;
      }
    }

    try {
      const gateway = await this.loadGateway();
      const opened = await gateway.open(sourceUri);
      if (
        !Number.isSafeInteger(opened.pageCount) ||
        opened.pageCount !== expectedPageCount
      ) {
        await closeQuietly(gateway, sourceUri);
        return err({ kind: 'thumbnail-source-failure' });
      }
      this.session = {
        gateway,
        sourceUri,
        pageCount: opened.pageCount,
      };
      return ok(undefined);
    } catch {
      return err({ kind: 'thumbnail-source-failure' });
    }
  }

  public render(
    page: number,
  ): Promise<Result<PdfPageThumbnail, PdfPageThumbnailError>> {
    const session = this.session;
    if (session === undefined) {
      return Promise.resolve(err({ kind: 'not-open' }));
    }
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > session.pageCount
    ) {
      return Promise.resolve(err({ kind: 'invalid-page', page }));
    }

    const rendering = this.renderPage(session, page);
    this.activeRenders.add(rendering);
    void rendering.finally(() => this.activeRenders.delete(rendering));
    return rendering;
  }

  public async close(): Promise<Result<void, PdfPageThumbnailError>> {
    const session = this.session;
    this.session = undefined;
    if (session === undefined) {
      return ok(undefined);
    }

    await Promise.allSettled([...this.activeRenders]);
    try {
      await session.gateway.close(session.sourceUri);
      return ok(undefined);
    } catch {
      return err({ kind: 'thumbnail-cleanup-failure' });
    }
  }

  private async renderPage(
    session: OpenPdfThumbnailSession,
    page: number,
  ): Promise<Result<PdfPageThumbnail, PdfPageThumbnailError>> {
    try {
      const image = await session.gateway.generate(
        session.sourceUri,
        page - 1,
        THUMBNAIL_SCALE,
        {
          format: 'jpeg',
          quality: THUMBNAIL_JPEG_QUALITY,
          maxDimension: THUMBNAIL_MAX_DIMENSION,
        },
      );
      if (
        image.uri.trim().length === 0 ||
        !Number.isFinite(image.width) ||
        image.width <= 0 ||
        !Number.isFinite(image.height) ||
        image.height <= 0
      ) {
        return err({ kind: 'thumbnail-rendering-failure' });
      }
      return ok({ page, ...image });
    } catch {
      return err({ kind: 'thumbnail-rendering-failure' });
    }
  }
}

async function closeQuietly(
  gateway: PdfPageImageGateway,
  sourceUri: string,
): Promise<void> {
  try {
    await gateway.close(sourceUri);
  } catch {
    // The source is already rejected; cleanup cannot make it usable.
  }
}
