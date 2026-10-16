import type { WorkspaceApi } from "../runtime/adapter.ts";

let storage: WorkspaceApi | undefined;
export function configureUserStorage(value?: WorkspaceApi) { storage = value; }
export function userStorage() { return storage; }

const listeners = new Set<() => void>();
export function storageChanged() { for (const listener of listeners) listener(); }
export function observeStorage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

/** Local writes must never silently degrade into temporary browser memory. */
export function reportStorageError(error: unknown) {
  if (storage && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("pcui-storage-error", { detail: error }));
}

let writes: Promise<unknown> = Promise.resolve();
const failed = new Map<string, () => Promise<unknown>>();
export function rememberStorageFailure(key: string, retry: () => Promise<unknown>, error: unknown) {
  failed.set(key, retry);
  reportStorageError(error);
}
const generations = new Map<string, number>();
export function cancelUserWrite(key: string) {
  generations.set(key, (generations.get(key) ?? 0) + 1);
  failed.delete(key);
}
export function queueStorageWrite<T>(work: () => Promise<T>): Promise<T> {
  const result = writes.then(work, work);
  writes = result.catch(() => {});
  return result;
}
export function persistUserWrite(key: string, work: () => Promise<unknown>): void {
  const generation = (generations.get(key) ?? 0) + 1;
  generations.set(key, generation);
  const current = () => generations.get(key) === generation;
  const write = async () => { if (current()) await work(); };
  void queueStorageWrite(write).then(() => {
    if (!current()) return;
    failed.delete(key);
    if (!failed.size) window.dispatchEvent(new Event("pcui-storage-saved"));
  }, error => { if (current()) { failed.set(key, write); reportStorageError(error); } });
}
export async function flushStorageWrites() {
  await writes;
  if (failed.size) throw new Error("Unsaved workspace records");
}
export async function retryStorageWrites() {
  for (const [key, work] of failed) {
    await queueStorageWrite(work);
    if (failed.get(key) === work) failed.delete(key);
  }
  if (!failed.size) window.dispatchEvent(new Event("pcui-storage-saved"));
}
