import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { strFromU8, unzipSync } from 'fflate';

import type {
  BookMetadataExtractor,
  ExtractedBookCover,
  ExtractedBookMetadata,
  ExtractedCoverMediaType,
  ImportFileReader,
  MetadataExtractionError,
} from '../../application';
import { normalizeBookMetadataText } from '../../application';
import type { FileImportSource } from '../../application/importing/importer';
import { err, ok, type Result } from '../../domain';

const EPUB_MIME_TYPE = 'application/epub+zip';
const EPUB_MIME_TYPE_PATH = 'mimetype';
const EPUB_CONTAINER_PATH = 'META-INF/container.xml';
const MAX_MIME_TYPE_BYTES = 128;
const MAX_CONTAINER_BYTES = 1024 * 1024;
const MAX_OPF_BYTES = 4 * 1024 * 1024;
const MAX_COVER_BYTES = 20 * 1024 * 1024;

const xmlParser = new XMLParser({
  alwaysCreateTextNode: false,
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  maxNestedTags: 128,
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: true,
  removeNSPrefix: true,
  trimValues: true,
});

type EpubMetadataError = Extract<
  MetadataExtractionError,
  | { readonly kind: 'corrupted-source' }
  | { readonly kind: 'metadata-extraction-failure' }
>;

interface ManifestItem {
  readonly href: string;
  readonly id?: string;
  readonly mediaType?: string;
  readonly properties?: string;
}

export class EpubMetadataExtractor
  implements BookMetadataExtractor<'epub'>
{
  public readonly format = 'epub' as const;

  public constructor(
    private readonly files: Pick<ImportFileReader, 'readAll'>,
  ) {}

  public async extract(
    source: FileImportSource,
  ): Promise<Result<ExtractedBookMetadata, MetadataExtractionError>> {
    try {
      const archive = await this.files.readAll(source.uri);
      return archive.ok
        ? extractEpubMetadata(archive.value)
        : err({ kind: 'permission-or-access-failure', source });
    } catch {
      return err({ kind: 'permission-or-access-failure', source });
    }
  }
}

export function extractEpubMetadata(
  archive: Uint8Array,
): Result<ExtractedBookMetadata, EpubMetadataError> {
  const mimeType = readArchiveEntry(
    archive,
    EPUB_MIME_TYPE_PATH,
    MAX_MIME_TYPE_BYTES,
  );
  if (!mimeType.ok || mimeType.value === null) {
    return err({ kind: 'corrupted-source', format: 'epub' });
  }
  if (decodeUtf8(mimeType.value) !== EPUB_MIME_TYPE) {
    return err({ kind: 'corrupted-source', format: 'epub' });
  }

  const container = readArchiveEntry(
    archive,
    EPUB_CONTAINER_PATH,
    MAX_CONTAINER_BYTES,
  );
  if (!container.ok) {
    return container;
  }
  if (container.value === null) {
    return err({ kind: 'metadata-extraction-failure', format: 'epub' });
  }
  const containerDocument = parseXmlDocument(container.value);
  if (!containerDocument.ok) {
    return containerDocument;
  }

  const packagePath = packagePathFromContainer(containerDocument.value);
  if (packagePath === undefined) {
    return err({ kind: 'metadata-extraction-failure', format: 'epub' });
  }

  const packageEntry = readArchiveEntry(archive, packagePath, MAX_OPF_BYTES);
  if (!packageEntry.ok) {
    return packageEntry;
  }
  if (packageEntry.value === null) {
    return err({ kind: 'metadata-extraction-failure', format: 'epub' });
  }
  const packageDocument = parseXmlDocument(packageEntry.value);
  if (!packageDocument.ok) {
    return packageDocument;
  }

  return metadataFromPackage(archive, packagePath, packageDocument.value);
}

function metadataFromPackage(
  archive: Uint8Array,
  packagePath: string,
  document: Record<string, unknown>,
): Result<ExtractedBookMetadata, EpubMetadataError> {
  const packageNode = asRecord(document.package);
  const metadata = asRecord(packageNode?.metadata);
  const manifest = asRecord(packageNode?.manifest);
  if (packageNode === undefined || metadata === undefined || manifest === undefined) {
    return err({ kind: 'metadata-extraction-failure', format: 'epub' });
  }

  const title = metadataText(metadata.title);
  const author = metadataText(metadata.creator);
  const manifestItems = parseManifestItems(manifest.item);
  const coverItem = findCoverItem(metadata, manifestItems);
  const cover =
    coverItem === undefined
      ? ok(undefined)
      : extractCover(archive, packagePath, coverItem);
  if (!cover.ok) {
    return cover;
  }

  return ok({
    ...(title === undefined ? {} : { title }),
    ...(author === undefined ? {} : { author }),
    ...(cover.value === undefined ? {} : { cover: cover.value }),
  });
}

function packagePathFromContainer(
  document: Record<string, unknown>,
): string | undefined {
  const container = asRecord(document.container);
  const rootfiles = asRecord(container?.rootfiles);
  for (const candidate of asArray(rootfiles?.rootfile)) {
    const rootfile = asRecord(candidate);
    const path = stringAttribute(rootfile, 'full-path');
    const normalized = path === undefined ? undefined : normalizeArchivePath(path);
    if (normalized !== undefined) {
      return normalized;
    }
  }
  return undefined;
}

function parseManifestItems(value: unknown): readonly ManifestItem[] {
  const items: ManifestItem[] = [];
  for (const candidate of asArray(value)) {
    const item = asRecord(candidate);
    const href = stringAttribute(item, 'href');
    if (href === undefined) {
      continue;
    }

    const id = stringAttribute(item, 'id');
    const mediaType = stringAttribute(item, 'media-type');
    const properties = stringAttribute(item, 'properties');
    items.push({
      href,
      ...(id === undefined ? {} : { id }),
      ...(mediaType === undefined ? {} : { mediaType }),
      ...(properties === undefined ? {} : { properties }),
    });
  }
  return items;
}

function findCoverItem(
  metadata: Record<string, unknown>,
  items: readonly ManifestItem[],
): ManifestItem | undefined {
  const epub3Cover = items.find((item) =>
    item.properties
      ?.split(/\s+/)
      .some((property) => property.toLowerCase() === 'cover-image'),
  );
  if (epub3Cover !== undefined) {
    return epub3Cover;
  }

  const legacyCoverId = legacyCoverIdentifier(metadata.meta);
  return legacyCoverId === undefined
    ? undefined
    : items.find((item) => item.id === legacyCoverId);
}

function legacyCoverIdentifier(value: unknown): string | undefined {
  for (const candidate of asArray(value)) {
    const meta = asRecord(candidate);
    if (stringAttribute(meta, 'name')?.toLowerCase() === 'cover') {
      return stringAttribute(meta, 'content');
    }
  }
  return undefined;
}

function extractCover(
  archive: Uint8Array,
  packagePath: string,
  item: ManifestItem,
): Result<ExtractedBookCover | undefined, EpubMetadataError> {
  const mediaType = coverMediaType(item.mediaType);
  const coverPath = resolveArchiveReference(packagePath, item.href);
  if (mediaType === undefined || coverPath === undefined) {
    return ok(undefined);
  }

  const entry = readArchiveEntry(archive, coverPath, MAX_COVER_BYTES);
  if (!entry.ok) {
    return entry;
  }
  if (entry.value === null || !coverSignatureMatches(mediaType, entry.value)) {
    return ok(undefined);
  }
  return ok({ mediaType, bytes: entry.value });
}

function coverMediaType(value: string | undefined): ExtractedCoverMediaType | undefined {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case 'image/jpg':
      return 'image/jpeg';
    case 'image/gif':
    case 'image/jpeg':
    case 'image/png':
    case 'image/svg+xml':
    case 'image/webp':
      return normalized;
    default:
      return undefined;
  }
}

function coverSignatureMatches(
  mediaType: ExtractedCoverMediaType,
  bytes: Uint8Array,
): boolean {
  switch (mediaType) {
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/svg+xml':
      return isSafeSvg(bytes);
    case 'image/gif':
      return startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    case 'image/webp':
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        bytes.byteLength >= 12 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
  }
}

function isSafeSvg(bytes: Uint8Array): boolean {
  const xml = decodeUtf8(bytes);
  if (
    xml === undefined ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    /<\s*(?:foreignObject|script)\b/i.test(xml) ||
    /\son[a-z]+\s*=/i.test(xml) ||
    /(?:href|src)\s*=\s*["']\s*(?:\/\/|file:|ftp:|https?:|javascript:)/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  ) {
    return false;
  }

  try {
    const parsed: unknown = xmlParser.parse(xml);
    const svg = isRecord(parsed) ? asRecord(parsed.svg) : undefined;
    return svg !== undefined && isSafeSvgTree(svg);
  } catch {
    return false;
  }
}

function isSafeSvgTree(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every(isSafeSvgTree);
  }
  if (!isRecord(value)) {
    return true;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    const attributeName = normalizedKey.startsWith('@_')
      ? normalizedKey.slice(2)
      : undefined;
    if (
      normalizedKey === 'script' ||
      normalizedKey === 'foreignobject' ||
      attributeName?.startsWith('on') === true
    ) {
      return false;
    }
    if (
      (attributeName === 'href' || attributeName === 'src') &&
      typeof child === 'string' &&
      (child.includes('&') ||
        /^(?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(child.trim()))
    ) {
      return false;
    }
    if (!isSafeSvgTree(child)) {
      return false;
    }
  }
  return true;
}

function parseXmlDocument(
  bytes: Uint8Array,
): Result<Record<string, unknown>, EpubMetadataError> {
  const xml = decodeUtf8(bytes);
  if (
    xml === undefined ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  ) {
    return err({ kind: 'metadata-extraction-failure', format: 'epub' });
  }

  try {
    const parsed: unknown = xmlParser.parse(xml);
    return isRecord(parsed)
      ? ok(parsed)
      : err({ kind: 'metadata-extraction-failure', format: 'epub' });
  } catch {
    return err({ kind: 'metadata-extraction-failure', format: 'epub' });
  }
}

function readArchiveEntry(
  archive: Uint8Array,
  entryPath: string,
  maximumBytes: number,
): Result<Uint8Array | null, EpubMetadataError> {
  let selectedCount = 0;
  let invalidSize = false;

  try {
    const entries = unzipSync(archive, {
      filter(entry) {
        if (entry.name !== entryPath) {
          return false;
        }
        selectedCount += 1;
        if (entry.originalSize <= 0 || entry.originalSize > maximumBytes) {
          invalidSize = true;
          return false;
        }
        return true;
      },
    });
    if (selectedCount > 1 || invalidSize) {
      return err({ kind: 'corrupted-source', format: 'epub' });
    }
    const entry = entries[entryPath];
    if (entry !== undefined && entry.byteLength > maximumBytes) {
      return err({ kind: 'corrupted-source', format: 'epub' });
    }
    return ok(entry ?? null);
  } catch {
    return err({ kind: 'corrupted-source', format: 'epub' });
  }
}

function decodeUtf8(bytes: Uint8Array): string | undefined {
  try {
    const value = strFromU8(bytes);
    return value.includes('\u0000') || value.includes('\ufffd') ? undefined : value;
  } catch {
    return undefined;
  }
}

function metadataText(value: unknown): string | undefined {
  for (const candidate of asArray(value)) {
    const raw =
      typeof candidate === 'string'
        ? candidate
        : stringValue(asRecord(candidate)?.['#text']);
    if (raw === undefined) {
      continue;
    }

    const validated = normalizeBookMetadataText(raw);
    if (validated !== undefined) {
      return validated;
    }
  }
  return undefined;
}

function resolveArchiveReference(
  packagePath: string,
  reference: string,
): string | undefined {
  const referencePath = reference.split(/[?#]/, 1)[0];
  if (
    referencePath === undefined ||
    referencePath.trim().length === 0 ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(referencePath)
  ) {
    return undefined;
  }

  const packageSegments = packagePath.split('/');
  packageSegments.pop();
  return normalizePathSegments(packageSegments, referencePath);
}

function normalizeArchivePath(value: string): string | undefined {
  return normalizePathSegments([], value);
}

function normalizePathSegments(
  baseSegments: readonly string[],
  value: string,
): string | undefined {
  if (value.startsWith('/') || value.includes('\\')) {
    return undefined;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return undefined;
  }
  if (decoded.startsWith('/') || decoded.includes('\\') || decoded.includes('\u0000')) {
    return undefined;
  }

  const segments = [...baseSegments];
  for (const segment of decoded.split('/')) {
    if (segment.length === 0 || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (segments.length === 0) {
        return undefined;
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.length === 0 ? undefined : segments.join('/');
}

function stringAttribute(
  value: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  return stringValue(value?.[`@_${name}`]);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return (
    bytes.byteLength >= signature.length &&
    signature.every((value, index) => bytes[index] === value)
  );
}
