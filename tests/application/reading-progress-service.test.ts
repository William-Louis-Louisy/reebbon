import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createReadingProgressService,
  type ReadingProgressRepository,
} from '../../src/application';
import {
  err,
  ok,
  type Book,
  type ReadingProgress,
  type Result,
} from '../../src/domain';

const book: Book<'epub'> = {
  id: 'book-1',
  title: 'The Book',
  format: 'epub',
  fileUri: 'file:///books/book-1/content.epub',
  createdAt: new Date('2026-09-03T08:00:00.000Z'),
};

test('reading progress service restores a coherent position for the book format', async () => {
  const stored: ReadingProgress = {
    bookId: book.id,
    position: { kind: 'epub', cfi: 'epubcfi(/6/8!/4/2)' },
    completionRatio: 0.42,
    updatedAt: new Date('2026-09-03T09:00:00.000Z'),
  };
  const repository = createRepository({ stored });
  const service = createReadingProgressService({
    repository,
    now: () => new Date('2026-09-03T10:00:00.000Z'),
  });

  assert.deepEqual(await service.load(book), ok({
    position: stored.position,
    completionRatio: 0.42,
  }));
  assert.deepEqual(repository.readBookIds, [book.id]);
});

test('reading progress service rejects mismatched persisted data', async () => {
  const repository = createRepository({
    stored: {
      bookId: book.id,
      position: { kind: 'pdf', page: 4 },
      completionRatio: 0.25,
      updatedAt: new Date('2026-09-03T09:00:00.000Z'),
    },
  });
  const service = createReadingProgressService({
    repository,
    now: () => new Date('2026-09-03T10:00:00.000Z'),
  });

  assert.deepEqual(
    await service.load(book),
    err({ kind: 'invalid-reading-progress', reason: 'format-mismatch' }),
  );
});

test('reading progress service persists position and completion as one record', async () => {
  const now = new Date('2026-09-03T10:00:00.000Z');
  const repository = createRepository();
  const service = createReadingProgressService({
    repository,
    now: () => now,
  });

  assert.deepEqual(
    await service.save(book, {
      position: { kind: 'epub', cfi: 'epubcfi(/6/10!/4/2)' },
      completionRatio: 0.5,
    }),
    ok(undefined),
  );
  assert.deepEqual(repository.saved, [{
    bookId: book.id,
    position: { kind: 'epub', cfi: 'epubcfi(/6/10!/4/2)' },
    completionRatio: 0.5,
    updatedAt: now,
  }]);
});

test('reading progress service serializes rapid page saves in event order', async () => {
  const firstWrite = deferred<Result<void, never>>();
  const saved: ReadingProgress[] = [];
  let writeCount = 0;
  const repository = createRepository({
    save: async (progress) => {
      saved.push(progress);
      writeCount += 1;
      return writeCount === 1 ? firstWrite.promise : ok(undefined);
    },
  });
  const service = createReadingProgressService({
    repository,
    now: () => new Date('2026-09-03T10:00:00.000Z'),
  });

  const first = service.save(book, {
    position: { kind: 'epub', cfi: 'epubcfi(/6/2!/4/2)' },
    completionRatio: 0.1,
  });
  const second = service.save(book, {
    position: { kind: 'epub', cfi: 'epubcfi(/6/4!/4/2)' },
    completionRatio: 0.2,
  });
  let didFlush = false;
  const flushed = service.flush().then((result) => {
    didFlush = true;
    return result;
  });
  await Promise.resolve();

  assert.equal(writeCount, 1);
  assert.equal(didFlush, false);
  firstWrite.resolve(ok(undefined));
  assert.deepEqual(await first, ok(undefined));
  assert.deepEqual(await second, ok(undefined));
  assert.deepEqual(
    saved.map((progress) => progress.position),
    [
      { kind: 'epub', cfi: 'epubcfi(/6/2!/4/2)' },
      { kind: 'epub', cfi: 'epubcfi(/6/4!/4/2)' },
    ],
  );
  assert.deepEqual(await flushed, ok(undefined));
  assert.equal(didFlush, true);
});

test('reading progress service types invalid values and repository exceptions', async () => {
  const repository = createRepository({
    save: async () => {
      throw new Error('database unavailable');
    },
  });
  const service = createReadingProgressService({
    repository,
    now: () => new Date('2026-09-03T10:00:00.000Z'),
  });

  assert.deepEqual(
    await service.save(book, {
      position: { kind: 'epub', cfi: 'epubcfi(/6/2!/4/2)' },
      completionRatio: Number.NaN,
    }),
    err({
      kind: 'invalid-reading-progress',
      reason: 'invalid-completion-ratio',
    }),
  );
  assert.deepEqual(
    await service.save(book, {
      position: { kind: 'epub', cfi: 'epubcfi(/6/4!/4/2)' },
      completionRatio: 0.2,
    }),
    err({ kind: 'persistence-failure', operation: 'write' }),
  );
  assert.equal(repository.saved.length, 0);
});

interface RepositoryOptions {
  readonly stored?: ReadingProgress | null;
  readonly save?: ReadingProgressRepository['save'];
}

function createRepository(options: RepositoryOptions = {}) {
  const readBookIds: string[] = [];
  const saved: ReadingProgress[] = [];
  const repository: ReadingProgressRepository & {
    readonly readBookIds: string[];
    readonly saved: ReadingProgress[];
  } = {
    readBookIds,
    saved,
    async getByBookId(bookId) {
      readBookIds.push(bookId);
      return ok(options.stored ?? null);
    },
    async save(progress) {
      if (options.save !== undefined) {
        return options.save(progress);
      }
      saved.push(progress);
      return ok(undefined);
    },
    async deleteByBookId() {
      return ok(undefined);
    },
  };
  return repository;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
