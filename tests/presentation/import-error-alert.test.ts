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
const directorySource = {
  kind: 'directory',
  uri: 'content://picker/album',
  name: 'album',
} as const;

const errors: readonly ImportError[] = [
  { kind: 'unsupported-format', detectedFormat: 'mobi' },
  { kind: 'corrupted-source', format: 'epub' },
  { kind: 'corrupted-source', format: 'pdf' },
  { kind: 'permission-or-access-failure', source },
  { kind: 'filesystem-failure', operation: 'copy' },
  { kind: 'filesystem-failure', operation: 'cleanup' },
  { kind: 'metadata-extraction-failure', format: 'epub' },
  { kind: 'metadata-extraction-failure', format: 'pdf' },
  { kind: 'persistence-failure', operation: 'save' },
  { kind: 'persistence-failure', operation: 'rollback' },
  { kind: 'corrupted-source', format: 'image-directory' },
  { kind: 'permission-or-access-failure', source: directorySource },
  { kind: 'corrupted-source', format: 'cbz' },
  { kind: 'filesystem-failure', operation: 'extract' },
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

test('PDF failures identify the selected format', () => {
  assert.match(getImportErrorAlert(errors[2]).message, /PDF/);
  assert.match(getImportErrorAlert(errors[7]).title, /PDF/);
});

test('cleanup and rollback failures do not hide an incomplete compensation', () => {
  assert.match(getImportErrorAlert(errors[5]).title, /nettoyage incomplet/i);
  assert.match(getImportErrorAlert(errors[9]).message, /annulation/i);
});

test('image-directory failures identify the folder instead of a file', () => {
  const corrupted = getImportErrorAlert(errors[10]);
  const inaccessible = getImportErrorAlert(errors[11]);

  assert.match(corrupted.title, /dossier/i);
  assert.match(corrupted.message, /JPEG\/PNG/i);
  assert.match(inaccessible.title, /dossier inaccessible/i);
  assert.match(inaccessible.message, /dossier sélectionné/i);
});

test('CBZ corruption and extraction failures identify the archive', () => {
  const corrupted = getImportErrorAlert(errors[12]);
  const extraction = getImportErrorAlert(errors[13]);

  assert.match(corrupted.message, /CBZ/);
  assert.match(extraction.title, /extraction impossible/i);
  assert.match(extraction.message, /archive/i);
  assert.match(getImportErrorAlert(errors[0]).message, /CBZ/);
});
