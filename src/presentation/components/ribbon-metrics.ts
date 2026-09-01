import { designSystemTokens } from '@/shared/theme';

export function normalizeProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(Math.max(progress, 0), 1);
}

export function getRibbonHeight(progress: number): number {
  const { minHeight, maxHeight } = designSystemTokens.components.ribbon;
  return minHeight + (maxHeight - minHeight) * normalizeProgress(progress);
}
