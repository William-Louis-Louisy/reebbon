/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { err, ok } from '../../src/domain';
import { PdfRenditionBridge } from '../../src/presentation/reading/pdf/pdf-rendition-bridge';

test('PDF bridge resolves opening from native readiness and exposes location', async () => {
  const bridge = new PdfRenditionBridge();
  const opening = bridge.open('file:///book.pdf', 4);
  assert.deepEqual(bridge.getSnapshot(), {
    status: 'opening',
    sessionId: 1,
    sourceUri: 'file:///book.pdf',
    initialPage: 4,
  });

  bridge.reportReady({ page: 4, totalPages: 10 });
  assert.deepEqual(await opening, ok(undefined));
  assert.deepEqual(await bridge.getLocation(), ok({ page: 4, totalPages: 10 }));

  bridge.reportLocation({ page: 5, totalPages: 10 });
  assert.deepEqual(await bridge.getLocation(), ok({ page: 5, totalPages: 10 }));
});

test('PDF bridge delegates bounded page navigation only while ready', async () => {
  const pages: number[] = [];
  const bridge = new PdfRenditionBridge();
  assert.deepEqual(await bridge.goTo(1), err({ kind: 'rendering-failure' }));
  const opening = bridge.open('file:///book.pdf');
  bridge.reportReady({ page: 1, totalPages: 3 });
  await opening;
  const detach = bridge.attachControls({ setPage: (page) => pages.push(page) });

  assert.deepEqual(await bridge.goTo(2), ok(undefined));
  assert.deepEqual(await bridge.goTo(4), err({ kind: 'rendering-failure' }));
  assert.deepEqual(pages, [2]);
  detach();
  assert.deepEqual(await bridge.goTo(3), err({ kind: 'rendering-failure' }));
});

test('PDF bridge keeps outline pages private behind common entry identifiers', async () => {
  const pages: number[] = [];
  const bridge = new PdfRenditionBridge();
  const opening = bridge.open('file:///book.pdf');
  bridge.reportReady(
    { page: 1, totalPages: 8 },
    [{ id: 'pdf-outline-0', label: 'Partie I', depth: 0, page: 3 }],
  );
  await opening;
  bridge.attachControls({ setPage: (page) => pages.push(page) });

  assert.deepEqual(await bridge.getTableOfContents(), {
    ok: true,
    value: [{ id: 'pdf-outline-0', label: 'Partie I', depth: 0 }],
  });
  assert.deepEqual(
    await bridge.goToTableOfContentsEntry('pdf-outline-0'),
    ok(undefined),
  );
  assert.deepEqual(
    await bridge.goToTableOfContentsEntry('unknown'),
    err({ kind: 'rendering-failure' }),
  );
  assert.deepEqual(pages, [3]);
});

test('PDF bridge converts timeout and native failures into typed failures', async () => {
  const timedOut = new PdfRenditionBridge(1);
  assert.deepEqual(
    await timedOut.open('file:///slow.pdf'),
    err({ kind: 'rendering-failure' }),
  );

  const failed = new PdfRenditionBridge();
  const opening = failed.open('file:///broken.pdf');
  failed.reportFailure({ kind: 'content-access-failure' });
  assert.deepEqual(await opening, err({ kind: 'content-access-failure' }));
  assert.deepEqual(failed.getSnapshot(), {
    status: 'failure',
    sessionId: 1,
    error: { kind: 'content-access-failure' },
  });
});

test('closing PDF bridge settles pending work and resets the session', async () => {
  const bridge = new PdfRenditionBridge();
  const opening = bridge.open('file:///book.pdf');

  assert.deepEqual(await bridge.close(), ok(undefined));
  assert.deepEqual(await opening, err({ kind: 'rendering-failure' }));
  assert.deepEqual(bridge.getSnapshot(), { status: 'idle', sessionId: 1 });
});
