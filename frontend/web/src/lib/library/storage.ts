/** A transaction seam: browser IndexedDB online, an atomic workspace document locally. */
import type { BoxRecord, LibraryLayout, TeamRecord } from "./records.ts";
import { libraryDb } from "./db.ts";
import { queueStorageWrite, storageChanged, userStorage } from "../userStorage.ts";

interface Rows<T> {
  toArray(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  add(row: T): Promise<unknown>;
  put(row: T): Promise<unknown>;
  bulkAdd(rows: readonly T[]): Promise<unknown>;
  bulkPut(rows: readonly T[]): Promise<unknown>;
  delete(id: string): Promise<unknown>;
  bulkDelete(ids: readonly string[]): Promise<unknown>;
}
type Meta = { id: "layout" } & LibraryLayout;
export interface LibraryTables { teams: Rows<TeamRecord>; box: Rows<BoxRecord>; meta: Rows<Meta> }

function rows<T extends { id: string }>(values: unknown[]): Rows<T> {
  const id = (row: unknown) => (row as { id?: unknown } | null)?.id;
  const table: Rows<T> = {
    toArray: async () => values as T[],
    get: async key => values.find(row => id(row) === key) as T | undefined,
    add: async row => { if (values.some(value => id(value) === row.id)) throw new Error("Duplicate record"); values.push(row); },
    put: async row => { const index = values.findIndex(value => id(value) === row.id); if (index < 0) values.push(row); else values[index] = row; },
    bulkAdd: async items => { for (const row of items) await table.add(row); },
    bulkPut: async items => { for (const row of items) await table.put(row); },
    delete: async key => { const index = values.findIndex(value => id(value) === key); if (index >= 0) values.splice(index, 1); },
    bulkDelete: async keys => { for (const key of keys) await table.delete(key); },
  };
  return table;
}

export async function libraryTransaction<T>(write: boolean, work: (db: LibraryTables) => Promise<T>): Promise<T> {
  const local = userStorage();
  if (!local) {
    const db = libraryDb();
    return db.transaction(write ? "rw" : "r", db.teams, db.box, db.meta, async () => work(db));
  }
  const run = async () => {
    const document = await local.library();
    const meta: unknown[] = document.layout == null ? [] : [document.layout];
    const tables: LibraryTables = { teams: rows(document.teams), box: rows(document.box), meta: rows(meta) };
    const result = await work(tables);
    if (write) {
      await local.saveLibrary({ ...document, layout: meta[0] ?? null });
      storageChanged();
    }
    return result;
  };
  if (!write) return run();
  return queueStorageWrite(run);
}
