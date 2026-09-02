/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { strToU8, zipSync, type Zippable } from 'fflate';

import type { ImportFileReader } from '../../src/application';
import { ok } from '../../src/domain';
import {
  EpubMetadataExtractor,
  extractEpubMetadata,
} from '../../src/infrastructure/importing/epub-metadata-extractor';

const jpegCover = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0xd9]);
const pngCover = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
]);

interface EpubFixtureOptions {
  readonly opf: string;
  readonly packagePath?: string;
  readonly extraEntries?: Readonly<Record<string, Uint8Array>>;
  readonly includeMimeType?: boolean;
}

function createEpubFixture(options: EpubFixtureOptions): Uint8Array {
  const packagePath = options.packagePath ?? 'OPS/package.opf';
  const entries: Zippable = {
    ...(options.includeMimeType === false
      ? {}
      : {
          mimetype: [strToU8('application/epub+zip'), { level: 0 }],
        }),
    'META-INF/container.xml': strToU8(`
      <?xml version="1.0" encoding="UTF-8"?>
      <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="${packagePath}" media-type="application/oebps-package+xml" />
        </rootfiles>
      </container>
    `.trim()),
    [packagePath]: strToU8(options.opf.trim()),
    ...options.extraEntries,
  };
  return zipSync(entries);
}

test('EPUB 3 metadata extraction validates title, author, and raster cover', () => {
  const archive = createEpubFixture({
    opf: `
      <?xml version="1.0" encoding="UTF-8"?>
      <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
        <metadata>
          <dc:title>North &amp; South</dc:title>
          <dc:creator>Elizabeth Gaskell</dc:creator>
        </metadata>
        <manifest>
          <item id="cover" href="Images/cover%20art.jpg" media-type="image/jpeg" properties="cover-image" />
        </manifest>
        <spine />
      </package>
    `,
    extraEntries: { 'OPS/Images/cover art.jpg': jpegCover },
  });

  assert.deepEqual(extractEpubMetadata(archive), {
    ok: true,
    value: {
      title: 'North & South',
      author: 'Elizabeth Gaskell',
      cover: { mediaType: 'image/jpeg', bytes: jpegCover },
    },
  });
});

test('EPUB 2 metadata extraction resolves the legacy cover identifier', () => {
  const archive = createEpubFixture({
    packagePath: 'OEBPS/content.opf',
    opf: `
      <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
        <metadata>
          <dc:title>Legacy Book</dc:title>
          <meta name="cover" content="cover-image" />
        </metadata>
        <manifest>
          <item id="cover-image" href="../cover.png" media-type="image/png" />
        </manifest>
        <spine />
      </package>
    `,
    extraEntries: { 'cover.png': pngCover },
  });

  assert.deepEqual(extractEpubMetadata(archive), {
    ok: true,
    value: {
      title: 'Legacy Book',
      cover: { mediaType: 'image/png', bytes: pngCover },
    },
  });
});

test('invalid optional metadata never enters the validated result', () => {
  const oversizedTitle = 'x'.repeat(501);
  const archive = createEpubFixture({
    opf: `
      <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
        <metadata><dc:title>${oversizedTitle}</dc:title></metadata>
        <manifest>
          <item id="cover" href="../../../escape.jpg" media-type="image/jpeg" properties="cover-image" />
        </manifest>
        <spine />
      </package>
    `,
    extraEntries: { 'escape.jpg': jpegCover },
  });

  assert.deepEqual(extractEpubMetadata(archive), { ok: true, value: {} });
});

test('safe SVG covers are retained while active SVG content is rejected', () => {
  const safeSvg = strToU8(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" /></svg>',
  );
  const unsafeSvg = strToU8(
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="javascript&#58;alert(1)" /></svg>',
  );
  const opf = `
    <package>
      <metadata><title>SVG Book</title></metadata>
      <manifest>
        <item id="cover" href="cover.svg" media-type="image/svg+xml" properties="cover-image" />
      </manifest>
    </package>
  `;

  assert.deepEqual(
    extractEpubMetadata(
      createEpubFixture({ opf, extraEntries: { 'OPS/cover.svg': safeSvg } }),
    ),
    {
      ok: true,
      value: {
        title: 'SVG Book',
        cover: { mediaType: 'image/svg+xml', bytes: safeSvg },
      },
    },
  );
  assert.deepEqual(
    extractEpubMetadata(
      createEpubFixture({ opf, extraEntries: { 'OPS/cover.svg': unsafeSvg } }),
    ),
    { ok: true, value: { title: 'SVG Book' } },
  );
});

test('invalid EPUB structure returns typed extraction errors', () => {
  const missingMimeType = createEpubFixture({
    includeMimeType: false,
    opf: '<package><metadata /><manifest /></package>',
  });
  const unsafeXml = createEpubFixture({
    opf: `
      <!DOCTYPE package [<!ENTITY payload "unsafe">]>
      <package><metadata><title>&payload;</title></metadata><manifest /></package>
    `,
  });

  assert.deepEqual(extractEpubMetadata(missingMimeType), {
    ok: false,
    error: { kind: 'corrupted-source', format: 'epub' },
  });
  assert.deepEqual(extractEpubMetadata(unsafeXml), {
    ok: false,
    error: { kind: 'metadata-extraction-failure', format: 'epub' },
  });
  assert.deepEqual(extractEpubMetadata(new Uint8Array([0x50, 0x4b, 0x03])), {
    ok: false,
    error: { kind: 'corrupted-source', format: 'epub' },
  });
});

test('EPUB metadata adapter maps inaccessible files without throwing', async () => {
  const files: ImportFileReader = {
    readPrefix() {
      throw new Error('Not used by metadata extraction.');
    },
    readAll() {
      throw new Error('Opaque native failure.');
    },
  };
  const extractor = new EpubMetadataExtractor(files);
  const source = {
    kind: 'file',
    uri: 'content://missing.epub',
    name: 'missing.epub',
  } as const;

  assert.deepEqual(await extractor.extract(source), {
    ok: false,
    error: { kind: 'permission-or-access-failure', source },
  });
});

test('EPUB metadata adapter extracts an archive read through its generic port', async () => {
  const archive = createEpubFixture({
    opf: `
      <package>
        <metadata><title>Port Book</title></metadata>
        <manifest>
          <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" />
        </manifest>
      </package>
    `,
  });
  const files: ImportFileReader = {
    readPrefix() {
      throw new Error('Not used by metadata extraction.');
    },
    readAll() {
      return Promise.resolve(ok(archive));
    },
  };

  assert.deepEqual(
    await new EpubMetadataExtractor(files).extract({
      kind: 'file',
      uri: 'file:///book.epub',
      name: 'book.epub',
    }),
    { ok: true, value: { title: 'Port Book' } },
  );
});
