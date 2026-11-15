import type { PGlite } from "@electric-sql/pglite";
export declare const ROOT: string;
export declare function createTestDb(...extraSql: string[]): Promise<PGlite>;
export declare function asUser<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T>;
