/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { strToU8, zipSync } from 'fflate';

import {
  createEpubImporter,
  createImportFormatDetector,
  createListLibraryBooks,
  type ImportFileReader,
} from '../../src/application';
import { err, ok } from '../../src/domain';
import { LocalBookContentStore } from '../../src/infrastructure/filesystem/local-book-content-store';
import type { FileSystemGateway } from '../../src/infrastructure/filesystem/file-system-gateway';
import { migrateDatabase } from '../../src/infrastructure/database/migrations';
import { SqliteBookRepository } from '../../src/infrastructure/database/repositories/sqlite-book-repository';
import { SqliteReadingProgressRepository } from '../../src/infrastructure/database/repositories/sqlite-reading-progress-repository';
import { EpubMetadataExtractor } from '../../src/infrastructure/importing/epub-metadata-extractor';
import { NodeSqliteConnection } from '../infrastructure/database/node-sqlite-connection';

class MemoryFileSystemGateway implements FileSystemGateway {
  public readonly documentDirectoryUri = 'file:///documents';
  public readonly cacheDirectoryUri = 'file:///cache';
  public readonly directories = new Set<string>();
  public readonly files = new Set<string>();
  public readonly fileBytes = new Map<string, Uint8Array>();

  public createDirectory(uri: string, idempotent: boolean): Promise<void> {
    if (this.directories.has(uri) && !idempotent) {
      throw new Error('Directory already exists.');
    }
    this.directories.add(uri);
    return Promise.resolve();
  }

  public directoryExists(uri: string): boolean {
    return this.directories.has(uri);
  }

  public fileExists(uri: string): boolean {
    return this.files.has(uri);
  }

  public copyFile(sourceUri: string, destinationUri: string): Promise<void> {
    const bytes = this.fileBytes.get(sourceUri);
    if (!this.files.has(sourceUri) || bytes === undefined) {
      throw new Error('Source file does not exist.');
    }
    this.files.add(destinationUri);
    this.fileBytes.set(destinationUri, bytes.slice());
    return Promise.resolve();
  }

  public writeFile(destinationUri: string, bytes: Uint8Array): Promise<void> {
    this.files.add(destinationUri);
    this.fileBytes.set(destinationUri, bytes.slice());
    return Promise.resolve();
  }

  public moveDirectory(sourceUri: string, destinationUri: string): Promise<void> {
    if (!this.directories.delete(sourceUri)) {
      throw new Error('Staging directory does not exist.');
    }
    this.directories.add(destinationUri);
    for (const file of [...this.files]) {
      if (file.startsWith(`${sourceUri}/`)) {
        this.files.delete(file);
        const destinationFileUri = `${destinationUri}${file.slice(sourceUri.length)}`;
        this.files.add(destinationFileUri);
        const bytes = this.fileBytes.get(file);
        this.fileBytes.delete(file);
        if (bytes !== undefined) {
          this.fileBytes.set(destinationFileUri, bytes);
        }
      }
    }
    return Promise.resolve();
  }

  public deleteDirectory(uri: string): Promise<void> {
    this.directories.delete(uri);
    for (const file of [...this.files]) {
      if (file.startsWith(`${uri}/`)) {
        this.files.delete(file);
        this.fileBytes.delete(file);
      }
    }
    return Promise.resolve();
  }
}

test('a persisted EPUB appears in the repository-backed library immediately', async () => {
  const connection = new NodeSqliteConnection();
  const fileSystem = new MemoryFileSystemGateway();
  const content = new LocalBookContentStore(fileSystem);
  const sourceUri = 'content://picker/walking-skeleton.epub';
  const coverBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const archive = zipSync({
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8(
      '<container><rootfiles><rootfile full-path="OPS/package.opf" /></rootfiles></container>',
    ),
    'OPS/package.opf': strToU8(`
      <package xmlns:dc="http://purl.org/dc/elements/1.1/">
        <metadata>
          <dc:title>Repository Walking Skeleton</dc:title>
          <dc:creator>Reebbon Test</dc:creator>
        </metadata>
        <manifest>
          <item id="cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image" />
        </manifest>
      </package>
    `),
    'OPS/cover.jpg': coverBytes,
  });
  fileSystem.files.add(sourceUri);
  fileSystem.fileBytes.set(sourceUri, archive);

  await migrateDatabase(connection);
  assert.equal((await content.initialize()).ok, true);
  const books = new SqliteBookRepository(connection);
  const readingProgress = new SqliteReadingProgressRepository(connection);
  const identifiers = ['epub-book', 'import-job'];
  const files: ImportFileReader = {
    readPrefix(uri, byteLength) {
      const bytes = fileSystem.fileBytes.get(uri);
      return Promise.resolve(
        bytes === undefined
          ? err({ kind: 'permission-or-access-failure' })
          : ok(bytes.slice(0, byteLength)),
      );
    },
    readAll(uri) {
      const bytes = fileSystem.fileBytes.get(uri);
      return Promise.resolve(
        bytes === undefined
          ? err({ kind: 'permission-or-access-failure' })
          : ok(bytes.slice()),
      );
    },
  };
  const importer = createEpubImporter({
    books,
    content,
    detector: createImportFormatDetector({ files }),
    metadata: new EpubMetadataExtractor(files),
    createId() {
      const id = identifiers.shift();
      if (id === undefined) {
        throw new Error('No deterministic identifier available.');
      }
      return id;
    },
    now: () => new Date('2026-09-01T14:00:00.000Z'),
  });

  try {
    const imported = await importer.importBook({
      kind: 'file',
      uri: sourceUri,
      name: 'Walking Skeleton.epub',
      mimeType: 'application/epub+zip',
    });
    const library = await createListLibraryBooks({ books, readingProgress })();

    assert.equal(imported.ok, true);
    assert.equal(library.ok, true);
    assert.deepEqual(library.ok && library.value[0], {
      book: {
        id: 'epub-book',
        title: 'Repository Walking Skeleton',
        author: 'Reebbon Test',
        format: 'epub',
        fileUri: 'file:///documents/reebbon/books/epub-book/book.epub',
        coverUri: 'file:///documents/reebbon/books/epub-book/cover.jpg',
        createdAt: new Date('2026-09-01T14:00:00.000Z'),
      },
      progress: 0,
    });
    assert.equal(
      fileSystem.files.has(
        'file:///documents/reebbon/books/epub-book/book.epub',
      ),
      true,
    );
    assert.deepEqual(
      fileSystem.fileBytes.get(
        'file:///documents/reebbon/books/epub-book/cover.jpg',
      ),
      coverBytes,
    );
  } finally {
    await connection.close();
  }
});
