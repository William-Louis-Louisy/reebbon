/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { designSystemTokens, readingThemes } from '../../src/shared/theme';
import {
  createLiterataInjection,
  epubCoreThemes,
  getEpubFolio,
  parseEpubDisplayLocation,
  parseEpubTableOfContents,
} from '../../src/presentation/reading/epub/epub-reader-model';

const coreLocation = {
  start: {
    cfi: 'epubcfi(/6/4!/4/2/2)',
    location: 124,
  },
};

test('WebView locations are validated and normalize both epub.js progress units', () => {
  assert.deepEqual(
    parseEpubDisplayLocation(coreLocation, 500, 0.25, 'ratio'),
    {
      ok: true,
      value: {
        cfi: 'epubcfi(/6/4!/4/2/2)',
        completionRatio: 0.25,
        locationIndex: 124,
        totalLocations: 500,
      },
    },
  );
  assert.equal(
    parseEpubDisplayLocation(coreLocation, 500, 25, 'percentage').ok,
    true,
  );
  assert.deepEqual(
    parseEpubDisplayLocation(
      { start: { ...coreLocation.start, percentage: 0.4 } },
      0,
      null,
      'ratio',
    ),
    {
      ok: true,
      value: {
        cfi: 'epubcfi(/6/4!/4/2/2)',
        completionRatio: 0.4,
        locationIndex: 124,
        totalLocations: 0,
      },
    },
  );
  assert.deepEqual(
    parseEpubDisplayLocation({ start: { cfi: 'chapter', location: -1 } }, 2, 0, 'ratio'),
    { ok: false, error: { kind: 'invalid-epub-location' } },
  );
});

test('reader themes preserve semantic surfaces and contrast for EPUB content', () => {
  assert.equal(epubCoreThemes.paper.body?.background, readingThemes.paper.background);
  assert.equal(epubCoreThemes.sepia.body?.color, readingThemes.sepia.text);
  assert.equal(epubCoreThemes.night.body?.background, readingThemes.night.background);
  assert.equal(
    epubCoreThemes.night.a?.color,
    designSystemTokens.colors.oxbloodTint,
  );
});

test('Literata injection accepts only bundled font data and folios stay bounded', () => {
  const injection = createLiterataInjection('data:font/ttf;base64,QUJDRA==');

  assert.match(injection, /Reebbon Literata/);
  assert.match(injection, /rendition\.hooks\.content/);
  assert.equal(createLiterataInjection('https://fonts.example/font.ttf'), 'true;');
  assert.deepEqual(
    getEpubFolio({
      cfi: 'epubcfi(/6/4!/4/2/2)',
      completionRatio: 1,
      locationIndex: 600,
      totalLocations: 500,
    }),
    { current: 500, total: 500 },
  );
});

test('EPUB navigation is flattened into validated reader entries', () => {
  assert.deepEqual(
    parseEpubTableOfContents([
      {
        id: 'part-one',
        href: 'Text/part-one.xhtml',
        label: '  Partie   I  ',
        subitems: [
          {
            id: 'chapter-one',
            href: 'Text/chapter-one.xhtml#start',
            label: 'Chapitre 1',
            subitems: [],
          },
        ],
      },
    ]),
    {
      ok: true,
      value: {
        entries: [
          { id: 'toc-0', label: 'Partie I', depth: 0 },
          { id: 'toc-1', label: 'Chapitre 1', depth: 1 },
        ],
        targets: {
          'toc-0': 'Text/part-one.xhtml',
          'toc-1': 'Text/chapter-one.xhtml#start',
        },
      },
    },
  );
});

test('EPUB navigation ignores unsafe entries and rejects malformed roots', () => {
  assert.deepEqual(
    parseEpubTableOfContents([
      { href: 'https://example.com/chapter', label: 'Remote', subitems: [] },
      { href: 'javascript:alert(1)', label: 'Script', subitems: [] },
      { href: 'Text/safe.xhtml', label: 'Safe', subitems: [] },
    ]),
    {
      ok: true,
      value: {
        entries: [{ id: 'toc-0', label: 'Safe', depth: 0 }],
        targets: { 'toc-0': 'Text/safe.xhtml' },
      },
    },
  );
  assert.deepEqual(parseEpubTableOfContents({ toc: [] }), {
    ok: false,
    error: { kind: 'invalid-epub-table-of-contents' },
  });
});
