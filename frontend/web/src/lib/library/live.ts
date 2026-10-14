import { liveQuery } from "dexie";
import { loadLibrary, type LibraryState } from "./repo.ts";

export type LiveRead<T> = T | "unavailable" | undefined;
let state: LiveRead<LibraryState>;
let subscription: { unsubscribe(): void } | undefined;
const listeners = new Set<() => void>();

export const readLibrarySnapshot = () => state;

/** Share one observed read, including cross-tab writes, and stop with the last consumer. A later
 * subscriber reads afresh rather than showing a copy that missed writes while nobody watched. */
export function subscribeLibrary(listener: () => void): () => void {
  listeners.add(listener);
  // An explicit async querier lets Dexie retain observation across the vocabulary's native await.
  subscription ??= liveQuery(async () => {
    try { return await loadLibrary(); } catch { return "unavailable" as const; }
  }).subscribe(value => {
    state = value;
    for (const notify of listeners) notify();
  });
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    subscription?.unsubscribe();
    subscription = undefined;
    state = undefined;
  };
}
