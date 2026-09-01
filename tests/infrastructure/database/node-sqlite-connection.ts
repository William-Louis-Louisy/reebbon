/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';

import type {
  SqliteConnection,
  SqliteParameter,
} from '../../../src/infrastructure/database/sqlite-connection';

export class NodeSqliteConnection implements SqliteConnection {
  private readonly database = new DatabaseSync(':memory:');

  public exec(sql: string): Promise<void> {
    this.database.exec(sql);
    return Promise.resolve();
  }

  public run(sql: string, parameters: readonly SqliteParameter[] = []): Promise<void> {
    this.database.prepare(sql).run(...parameters);
    return Promise.resolve();
  }

  public getFirst<T>(
    sql: string,
    parameters: readonly SqliteParameter[] = [],
  ): Promise<T | null> {
    const row = this.database.prepare(sql).get(...parameters);
    return Promise.resolve((row as T | undefined) ?? null);
  }

  public getAll<T>(sql: string, parameters: readonly SqliteParameter[] = []): Promise<T[]> {
    return Promise.resolve(this.database.prepare(sql).all(...parameters) as T[]);
  }

  public async transaction(task: (transaction: SqliteConnection) => Promise<void>): Promise<void> {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      await task(this);
      this.database.exec('COMMIT');
    } catch (error: unknown) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  public close(): Promise<void> {
    this.database.close();
    return Promise.resolve();
  }
}
