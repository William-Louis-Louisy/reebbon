import type {
  PdfRenditionLocation,
  PdfRenditionTableOfContentsEntry,
} from '@/application';
import { err, ok, type Result } from '@/domain';
import { designSystemTokens } from '@/shared/theme';

const MAX_OUTLINE_DEPTH = 12;
const MAX_OUTLINE_NODES = 5_000;
const MAX_OUTLINE_TITLE_LENGTH = 240;

export interface InvalidPdfLocationError {
  readonly kind: 'invalid-pdf-location';
}

export interface PdfNavigationGridMetrics {
  readonly columns: number;
  readonly contentWidth: number;
  readonly gap: number;
  readonly horizontalPadding: number;
  readonly itemWidth: number;
}

export const pdfZoomConfiguration = {
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 3,
  fitPolicy: 2,
  doubleTapEnabled: true,
} as const;

export function parsePdfLocation(
  page: unknown,
  totalPages: unknown,
): Result<PdfRenditionLocation, InvalidPdfLocationError> {
  return Number.isSafeInteger(page) &&
    typeof page === 'number' &&
    page >= 1 &&
    Number.isSafeInteger(totalPages) &&
    typeof totalPages === 'number' &&
    totalPages >= 1 &&
    page <= totalPages
    ? ok({ page, totalPages })
    : err({ kind: 'invalid-pdf-location' });
}

export function getPdfFolio(
  location: PdfRenditionLocation | undefined,
): { readonly current: number; readonly total: number } | undefined {
  return location === undefined
    ? undefined
    : { current: location.page, total: location.totalPages };
}

export function parsePdfOutline(
  value: unknown,
  totalPages: number,
): readonly PdfRenditionTableOfContentsEntry[] {
  if (!Array.isArray(value) || !isValidTotalPages(totalPages)) {
    return [];
  }

  const entries: PdfRenditionTableOfContentsEntry[] = [];
  let visitedNodes = 0;
  const visit = (nodes: readonly unknown[], depth: number, parentId: string) => {
    for (let index = 0; index < nodes.length; index += 1) {
      if (visitedNodes >= MAX_OUTLINE_NODES) {
        return;
      }
      visitedNodes += 1;
      const node = nodes[index];
      if (!isRecord(node)) {
        continue;
      }
      const id = `${parentId}${index}`;
      const title = normalizeOutlineTitle(node.title);
      const pageIndex = node.pageIdx;
      if (
        title !== undefined &&
        Number.isSafeInteger(pageIndex) &&
        typeof pageIndex === 'number' &&
        pageIndex >= 0 &&
        pageIndex < totalPages
      ) {
        entries.push({ id, label: title, page: pageIndex + 1, depth });
      }
      if (Array.isArray(node.children) && depth < MAX_OUTLINE_DEPTH) {
        visit(node.children, depth + 1, `${id}.`);
      }
    }
  };

  visit(value, 0, 'pdf-outline-');
  return entries;
}

export function getPdfNavigationGridMetrics(
  viewportWidth: number,
): PdfNavigationGridMetrics {
  const grid = designSystemTokens.layout.pdfNavigationGrid;
  const safeViewportWidth =
    Number.isFinite(viewportWidth) && viewportWidth > 0
      ? viewportWidth
      : grid.fallbackViewportWidth;
  const contentWidth = Math.min(
    safeViewportWidth,
    designSystemTokens.layout.maxContentWidth,
  );
  const columns =
    safeViewportWidth >= grid.wideBreakpoint
      ? grid.wideColumns
      : safeViewportWidth >= grid.tabletBreakpoint
        ? grid.tabletColumns
        : grid.compactColumns;
  const horizontalPadding =
    safeViewportWidth >= grid.tabletBreakpoint
      ? grid.regularPadding
      : grid.compactPadding;
  const availableWidth =
    contentWidth - horizontalPadding * 2 - grid.gap * (columns - 1);

  return {
    columns,
    contentWidth,
    gap: grid.gap,
    horizontalPadding,
    itemWidth: availableWidth / columns,
  };
}

function isValidTotalPages(totalPages: number): boolean {
  return Number.isSafeInteger(totalPages) && totalPages >= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeOutlineTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const title = value.trim().replace(/\s+/g, ' ');
  return title.length === 0 || title.length > MAX_OUTLINE_TITLE_LENGTH
    ? undefined
    : title;
}
