/** Minimal SQL boundary shared by Workers and local import/verification tooling. */
export interface ContentStatement {
  bind(...values: unknown[]): ContentStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface ContentDatabase {
  prepare(sql: string): ContentStatement;
  batch(statements: ContentStatement[]): Promise<unknown>;
}
