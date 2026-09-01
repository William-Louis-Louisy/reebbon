import { designSystemTokens } from '@/shared/theme';

export interface LibraryGridMetrics {
  readonly columns: number;
  readonly contentWidth: number;
  readonly gap: number;
  readonly horizontalPadding: number;
  readonly itemWidth: number;
}

export function getLibraryGridMetrics(viewportWidth: number): LibraryGridMetrics {
  const grid = designSystemTokens.layout.libraryGrid;
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
