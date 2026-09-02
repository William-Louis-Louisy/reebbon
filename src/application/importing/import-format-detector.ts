import { err, ok, type Result } from '../../domain';

import type { ImportFileReader } from './import-file-reader';
import type { ImportError, ImportFormat, ImportSource } from './importer';

const SIGNATURE_BYTE_LENGTH = 8;

export type FormatDetectionError = Extract<
  ImportError,
  | { readonly kind: 'corrupted-source' }
  | { readonly kind: 'permission-or-access-failure' }
  | { readonly kind: 'unsupported-format' }
>;

export interface ImportFormatDetector {
  detect(
    source: ImportSource,
  ): Promise<Result<ImportFormat, FormatDetectionError>>;
}

export interface ImportFormatDetectorDependencies {
  readonly files: Pick<ImportFileReader, 'readPrefix'>;
}

export function createImportFormatDetector(
  dependencies: ImportFormatDetectorDependencies,
): ImportFormatDetector {
  return {
    async detect(source) {
      if (!hasValidSourceIdentity(source)) {
        return err({ kind: 'unsupported-format' });
      }
      if (source.kind === 'directory') {
        return ok('image-directory');
      }

      const expectedFormat = expectedFileFormat(source.name, source.mimeType);
      if (expectedFormat === undefined) {
        return err({
          kind: 'unsupported-format',
          detectedFormat: extensionFromName(source.name),
        });
      }

      let prefix: Awaited<ReturnType<ImportFileReader['readPrefix']>>;
      try {
        prefix = await dependencies.files.readPrefix(
          source.uri,
          SIGNATURE_BYTE_LENGTH,
        );
      } catch {
        return err({ kind: 'permission-or-access-failure', source });
      }
      if (!prefix.ok) {
        return err({ kind: 'permission-or-access-failure', source });
      }

      return signatureMatches(expectedFormat, prefix.value)
        ? ok(expectedFormat)
        : err({ kind: 'corrupted-source', format: expectedFormat });
    },
  };
}

function hasValidSourceIdentity(source: ImportSource): boolean {
  return source.uri.trim().length > 0 && source.name.trim().length > 0;
}

function expectedFileFormat(
  name: string,
  mimeType: string | undefined,
): Exclude<ImportFormat, 'image-directory'> | undefined {
  const extension = extensionFromName(name);
  switch (extension) {
    case 'epub':
      return 'epub';
    case 'pdf':
      return 'pdf';
    case 'cbz':
      return 'cbz';
    default:
      return formatFromMimeType(mimeType);
  }
}

function formatFromMimeType(
  mimeType: string | undefined,
): Exclude<ImportFormat, 'image-directory'> | undefined {
  switch (mimeType?.trim().toLowerCase()) {
    case 'application/epub+zip':
      return 'epub';
    case 'application/pdf':
      return 'pdf';
    case 'application/vnd.comicbook+zip':
    case 'application/x-cbz':
      return 'cbz';
    default:
      return undefined;
  }
}

function extensionFromName(name: string): string | undefined {
  const match = /\.([^.]+)$/.exec(name.trim());
  return match?.[1]?.toLowerCase();
}

function signatureMatches(
  format: Exclude<ImportFormat, 'image-directory'>,
  bytes: Uint8Array,
): boolean {
  switch (format) {
    case 'epub':
    case 'cbz':
      return hasZipSignature(bytes);
    case 'pdf':
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  }
}

function hasZipSignature(bytes: Uint8Array): boolean {
  return (
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
  );
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return (
    bytes.byteLength >= signature.length &&
    signature.every((value, index) => bytes[index] === value)
  );
}
