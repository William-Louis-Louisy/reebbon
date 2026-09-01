export type SqliteParameter = string | number | null;

export interface SqliteConnection {
  exec(sql: string): Promise<void>;
  run(sql: string, parameters?: readonly SqliteParameter[]): Promise<void>;
  getFirst<T>(sql: string, parameters?: readonly SqliteParameter[]): Promise<T | null>;
  getAll<T>(sql: string, parameters?: readonly SqliteParameter[]): Promise<T[]>;
  transaction(task: (transaction: SqliteConnection) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}
