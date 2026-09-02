import { strToU8, zipSync, type Zippable } from 'fflate';

export const largeEpubPageCount = 5_001;

export function createLargeEpubFixture(): Uint8Array {
  const entries: Zippable = {
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8(`
      <?xml version="1.0" encoding="UTF-8"?>
      <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml" />
        </rootfiles>
      </container>
    `.trim()),
  };
  const manifest: string[] = [];
  const spine: string[] = [];

  for (let page = 1; page <= largeEpubPageCount; page += 1) {
    const id = `page-${page}`;
    const path = `EPUB/pages/${id}.xhtml`;
    manifest.push(
      `<item id="${id}" href="pages/${id}.xhtml" media-type="application/xhtml+xml" />`,
    );
    spine.push(`<itemref idref="${id}" />`);
    entries[path] = strToU8(`
      <?xml version="1.0" encoding="UTF-8"?>
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head><title>Page ${page}</title></head>
        <body><p>Reebbon reader fixture page ${page}</p></body>
      </html>
    `.trim());
  }

  entries['EPUB/package.opf'] = strToU8(`
    <?xml version="1.0" encoding="UTF-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0" unique-identifier="book-id">
      <metadata>
        <dc:identifier id="book-id">urn:uuid:reebbon-large-fixture</dc:identifier>
        <dc:title>Reebbon 5001 Page Fixture</dc:title>
        <dc:language>fr</dc:language>
      </metadata>
      <manifest>${manifest.join('')}</manifest>
      <spine>${spine.join('')}</spine>
    </package>
  `.trim());

  return zipSync(entries, { level: 1 });
}

export function createMalformedEpubFixture(): Uint8Array {
  return new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
}
