/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { ImportError } from '../../src/application';
import { getImportErrorAlert } from '../../src/presentation/importing/import-error-alert';

const source = {
  kind: 'file',
  uri: 'content://picker/book.epub',
  name: 'book.epub',
} as const;

const errors: readonly ImportError[] = [
  { kind: 'unsupported-format', detectedFormat: 'mobi' },
  { kind: 'corrupted-source', format: 'epub' },
  { kind: 'permission-or-access-failure', source },
  { kind: 'filesystem-failure', operation: 'copy' },
  { kind: 'filesystem-failure', operation: 'cleanup' },
  { kind: 'metadata-extraction-failure', format: 'epub' },
  { kind: 'persistence-failure', operation: 'save' },
  { kind: 'persistence-failure', operation: 'rollback' },
];

test('every typed import error has an explicit user-facing alert', () => {
  for (const error of errors) {
    const alert = getImportErrorAlert(error);

    assert.notEqual(alert.title.trim(), '');
    assert.notEqual(alert.message.trim(), '');
    assert.equal(alert.message.endsWith('.'), true);
  }
});

test('unsupported and corrupted files have distinct actionable messages', () => {
  const unsupported = getImportErrorAlert(errors[0]);
  const corrupted = getImportErrorAlert(errors[1]);

  assert.match(unsupported.title, /non pris en charge/i);
  assert.match(unsupported.message, /EPUB/);
  assert.match(corrupted.title, /endommagé/i);
  assert.match(corrupted.message, /ne peut pas être importé/i);
  assert.notDeepEqual(unsupported, corrupted);
});

test('cleanup and rollback failures do not hide an incomplete compensation', () => {
  assert.match(getImportErrorAlert(errors[4]).title, /nettoyage incomplet/i);
  assert.match(getImportErrorAlert(errors[7]).message, /annulation/i);
});
