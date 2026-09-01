import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { SqliteConnection, SqliteParameter } from './sqlite-connection';

export const REEBBON_DATABASE_NAME = 'reebbon.db';

export class ExpoSqliteConnection implements SqliteConnection {
  public constructor(
    private readonly database: SQLiteDatabase,
    private readonly ownsConnection = true,
  ) {}

  public async exec(sql: string): Promise<void> {
    await this.database.execAsync(sql);
  }

  public async run(sql: string, parameters: readonly SqliteParameter[] = []): Promise<void> {
    await this.database.runAsync(sql, [...parameters]);
  }

  public getFirst<T>(
    sql: string,
    parameters: readonly SqliteParameter[] = [],
  ): Promise<T | null> {
    return this.database.getFirstAsync<T>(sql, [...parameters]);
  }

  public getAll<T>(sql: string, parameters: readonly SqliteParameter[] = []): Promise<T[]> {
    return this.database.getAllAsync<T>(sql, [...parameters]);
  }

  public async transaction(task: (transaction: SqliteConnection) => Promise<void>): Promise<void> {
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await task(new ExpoSqliteConnection(transaction, false));
    });
  }

  public async close(): Promise<void> {
    if (this.ownsConnection) {
      await this.database.closeAsync();
    }
  }
}

export async function openReebbonDatabase(): Promise<SqliteConnection> {
  const database = await openDatabaseAsync(REEBBON_DATABASE_NAME);
  return new ExpoSqliteConnection(database);
}
