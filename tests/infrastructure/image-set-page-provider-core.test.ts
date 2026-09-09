/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { parseStoredImageSetPages } from '../../src/infrastructure/reading/image-set-page-provider-core';

const root = 'file:///documents/reebbon/books/image-book';

test('stored image pages are validated and ordered by canonical index', () => {
  assert.deepEqual(
    parseStoredImageSetPages(
      [
        file('page-000003.jpg'),
        file('page-000001.jpg'),
        { kind: 'directory', name: 'nested', uri: `${root}/nested` },
        file('ignored.txt'),
        file('page-000002.png'),
      ],
      root,
      3,
    ),
    {
      ok: true,
      value: [
        { index: 0, uri: `${root}/page-000001.jpg` },
        { index: 1, uri: `${root}/page-000002.png` },
        { index: 2, uri: `${root}/page-000003.jpg` },
      ],
    },
  );
});

test('missing, duplicate or escaped stored pages fail closed', async (t) => {
  await t.test('missing page', () => {
    assert.deepEqual(
      parseStoredImageSetPages(
        [file('page-000001.jpg'), file('page-000003.jpg')],
        root,
        3,
      ),
      { ok: false, error: { kind: 'content-access-failure' } },
    );
  });

  await t.test('duplicate page index', () => {
    assert.deepEqual(
      parseStoredImageSetPages(
        [file('page-000001.jpg'), file('page-000001.png')],
        root,
        2,
      ),
      { ok: false, error: { kind: 'content-access-failure' } },
    );
  });

  await t.test('URI outside content root', () => {
    assert.deepEqual(
      parseStoredImageSetPages(
        [
          {
            kind: 'file',
            name: 'page-000001.jpg',
            uri: 'file:///outside/page-000001.jpg',
          },
        ],
        root,
        1,
      ),
      { ok: false, error: { kind: 'content-access-failure' } },
    );
  });
});

function file(name: string) {
  return { kind: 'file' as const, name, uri: `${root}/${name}` };
}
