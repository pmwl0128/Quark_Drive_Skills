import { liveQuery } from "dexie";
import { loadLibrary, type LibraryState } from "./repo.ts";
import { observeStorage, userStorage } from "../userStorage.ts";

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
  if (!subscription && userStorage()) {
    let active = true;
    let reading = false;
    let previous = "";
    const refresh = async () => {
      if (reading) return;
      reading = true;
      let next: LiveRead<LibraryState>;
      try { next = await loadLibrary(); } catch { next = "unavailable"; }
      reading = false;
      const signature = JSON.stringify(next && typeof next === "object"
        ? { layout: next.layout, teams: next.teams, box: next.box, broken: next.broken } : next);
      if (!active || signature === previous) return;
      previous = signature; state = next;
      for (const notify of listeners) notify();
    };
    const stop = observeStorage(() => { void refresh(); });
    const timer = window.setInterval(() => { void refresh(); }, 2000);
    window.addEventListener("focus", refresh);
    subscription = { unsubscribe: () => { active = false; stop(); window.clearInterval(timer); window.removeEventListener("focus", refresh); } };
    void refresh();
  }
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
