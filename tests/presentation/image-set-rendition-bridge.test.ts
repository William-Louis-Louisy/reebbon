/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { ImageSetPageProvider } from '../../src/application';
import { err, ok } from '../../src/domain';
import { ImageSetRenditionBridge } from '../../src/presentation/reading/images/image-set-rendition-bridge';

function createPageProvider(totalPages: number): ImageSetPageProvider {
  return {
    getPages(_contentUri, expectedTotalPages) {
      assert.equal(expectedTotalPages, totalPages);
      return Promise.resolve(
        ok(
          Array.from({ length: totalPages }, (_, index) => ({
            index,
            uri: `file:///book/page-${String(index + 1).padStart(6, '0')}.jpg`,
          })),
        ),
      );
    },
  };
}

test('image bridge opens 200+ page metadata without mounting page content', async () => {
  const bridge = new ImageSetRenditionBridge(createPageProvider(205));
  const snapshots: string[] = [];
  bridge.subscribe(() => snapshots.push(bridge.getSnapshot().status));

  assert.deepEqual(await bridge.open('file:///book', 205, 100), ok(undefined));
  const snapshot = bridge.getSnapshot();
  assert.equal(snapshot.status, 'ready');
  assert.equal(snapshot.pages?.length, 205);
  assert.deepEqual(snapshot.location, { index: 100, totalPages: 205 });
  assert.deepEqual(snapshots, ['opening', 'ready']);
  assert.deepEqual(
    await bridge.getLocation(),
    ok({ index: 100, totalPages: 205 }),
  );
});

test('image bridge delegates navigation and reports native paging locations', async () => {
  const indexes: number[] = [];
  const bridge = new ImageSetRenditionBridge(createPageProvider(5));
  await bridge.open('file:///book', 5);
  const detach = bridge.attachControls({
    setIndex(index) {
      indexes.push(index);
    },
  });

  assert.deepEqual(await bridge.goTo(1), ok(undefined));
  assert.deepEqual(bridge.getSnapshot().location, {
    index: 1,
    totalPages: 5,
  });
  bridge.reportLocation(2);
  assert.deepEqual(await bridge.getLocation(), ok({ index: 2, totalPages: 5 }));
  assert.deepEqual(await bridge.goTo(5), err({ kind: 'rendering-failure' }));
  assert.deepEqual(indexes, [1]);

  detach();
  assert.deepEqual(await bridge.goTo(3), err({ kind: 'rendering-failure' }));
});

test('image bridge validates provider output and converts access failures', async () => {
  const inaccessible = new ImageSetRenditionBridge({
    getPages: async () => err({ kind: 'content-access-failure' }),
  });
  assert.deepEqual(
    await inaccessible.open('file:///missing', 2),
    err({ kind: 'content-access-failure' }),
  );
  assert.deepEqual(inaccessible.getSnapshot(), {
    status: 'failure',
    sessionId: 1,
    error: { kind: 'content-access-failure' },
  });

  const malformed = new ImageSetRenditionBridge({
    getPages: async () =>
      ok([{ index: 1, uri: 'https://example.com/page.jpg' }]),
  });
  assert.deepEqual(
    await malformed.open('file:///book', 1),
    err({ kind: 'rendering-failure' }),
  );
});

test('closing image bridge drops page references and ignores stale loads', async () => {
  let resolvePages:
    | ((value: Awaited<ReturnType<ImageSetPageProvider['getPages']>>) => void)
    | undefined;
  const bridge = new ImageSetRenditionBridge({
    getPages: () =>
      new Promise((resolve) => {
        resolvePages = resolve;
      }),
  });
  const opening = bridge.open('file:///book', 1);

  assert.deepEqual(await bridge.close(), ok(undefined));
  resolvePages?.(ok([{ index: 0, uri: 'file:///book/page-000001.jpg' }]));
  assert.deepEqual(await opening, err({ kind: 'rendering-failure' }));
  assert.deepEqual(bridge.getSnapshot(), { status: 'idle', sessionId: 1 });
});
