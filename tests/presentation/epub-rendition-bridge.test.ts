/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { err, ok } from '../../src/domain';
import {
  EpubRenditionBridge,
  type EpubRenditionControls,
} from '../../src/presentation/reading/epub/epub-rendition-bridge';

const location = {
  cfi: 'epubcfi(/6/2!/4/2/2)',
  completionRatio: 0.25,
  locationIndex: 50,
  totalLocations: 200,
};

test('rendition bridge resolves open only after epub.js reports a location', async () => {
  const bridge = new EpubRenditionBridge();
  const snapshots: string[] = [];
  bridge.subscribe(() => snapshots.push(bridge.getSnapshot().status));

  const opening = bridge.open('file:///books/book.epub');
  assert.equal(bridge.getSnapshot().status, 'opening');
  bridge.reportReady(location);

  assert.deepEqual(await opening, ok(undefined));
  assert.deepEqual(await bridge.getLocation(), ok({
    cfi: location.cfi,
    completionRatio: 0.25,
  }));
  assert.deepEqual(snapshots, ['opening', 'ready']);
});

test('rendition bridge delegates page, CFI, and theme commands only when ready', async () => {
  const bridge = new EpubRenditionBridge();
  const calls: string[] = [];
  const controls: EpubRenditionControls = {
    goToLocation: (cfi) => calls.push(`go:${cfi}`),
    goPrevious: () => calls.push('previous'),
    goNext: () => calls.push('next'),
    changeTheme: (theme) => calls.push(`theme:${theme}`),
  };
  bridge.attachControls(controls);

  assert.deepEqual(bridge.nextPage(), err({ kind: 'rendering-failure' }));
  const opening = bridge.open('file:///books/book.epub');
  bridge.reportReady(location);
  await opening;

  assert.deepEqual(bridge.previousPage(), ok(undefined));
  assert.deepEqual(bridge.nextPage(), ok(undefined));
  assert.deepEqual(await bridge.goTo('epubcfi(/6/4!/4/2/2)'), ok(undefined));
  assert.deepEqual(await bridge.setTheme('paper'), ok(undefined));
  assert.deepEqual(calls, [
    'previous',
    'next',
    'go:epubcfi(/6/4!/4/2/2)',
    'theme:paper',
  ]);
});

test('malformed content times out as a typed rendering failure without throwing', async () => {
  const bridge = new EpubRenditionBridge(5);

  const result = await bridge.open('file:///books/malformed.epub');

  assert.deepEqual(result, err({ kind: 'rendering-failure' }));
  assert.deepEqual(bridge.getSnapshot(), {
    status: 'failure',
    sessionId: 1,
    error: { kind: 'rendering-failure' },
  });
  assert.deepEqual(await bridge.close(), ok(undefined));
});
