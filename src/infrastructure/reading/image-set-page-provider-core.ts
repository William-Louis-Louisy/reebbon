import type {
  ImageSetPage,
  ImageSetPageProviderError,
} from '../../application';
import { err, ok, type Result } from '../../domain';

const STORED_IMAGE_NAME = /^page-(\d{6})\.(jpg|png)$/;

export interface StoredImageSetEntry {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  readonly uri: string;
}

export function parseStoredImageSetPages(
  value: unknown,
  contentUri: string,
  expectedTotalPages: number,
): Result<readonly ImageSetPage[], ImageSetPageProviderError> {
  if (
    !Array.isArray(value) ||
    !contentUri.startsWith('file:///') ||
    !Number.isSafeInteger(expectedTotalPages) ||
    expectedTotalPages < 1
  ) {
    return err({ kind: 'content-access-failure' });
  }

  const root = contentUri.replace(/\/+$/, '');
  const pages: ImageSetPage[] = selectStoredPages(value, root);
  pages.sort((left, right) => left.index - right.index);
  if (
    pages.length !== expectedTotalPages ||
    pages.some((page, index) => page.index !== index)
  ) {
    return err({ kind: 'content-access-failure' });
  }
  return ok(pages);
}

function selectStoredPages(value: readonly unknown[], root: string): ImageSetPage[] {
  const pages: ImageSetPage[] = [];
  const indexes = new Set<number>();
  for (const candidate of value) {
    if (!isStoredImageSetEntry(candidate) || candidate.kind !== 'file') {
      continue;
    }
    const match = STORED_IMAGE_NAME.exec(candidate.name);
    if (match === null) {
      continue;
    }
    const pageNumber = Number(match[1]);
    const index = pageNumber - 1;
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      indexes.has(index) ||
      candidate.uri !== `${root}/${candidate.name}`
    ) {
      return [];
    }
    indexes.add(index);
    pages.push({ index, uri: candidate.uri });
  }
  return pages;
}

function isStoredImageSetEntry(value: unknown): value is StoredImageSetEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value.kind === 'file' || value.kind === 'directory') &&
    'name' in value &&
    typeof value.name === 'string' &&
    'uri' in value &&
    typeof value.uri === 'string'
  );
}
