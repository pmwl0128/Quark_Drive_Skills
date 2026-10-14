import "fake-indexeddb/auto";
import { afterEach, expect, test, vi } from "vitest";
vi.mock("./vocabulary.ts", () => ({ loadLibraryVocabulary: async () => undefined }));
import { LibraryDb, setLibraryDbForTests } from "./db.ts";
import * as repo from "./repo.ts";
import { readLibrarySnapshot, subscribeLibrary } from "./live.ts";

const stops: Array<() => void> = [];
let db: LibraryDb;
afterEach(async () => {
  for (const stop of stops.splice(0)) stop();
  vi.restoreAllMocks();
  setLibraryDbForTests(null);
  await db.delete();
});

test("page and dock share a live read, see writes, and reopen without an unobserved stale snapshot", async () => {
  db = new LibraryDb("shared-live-read-test");
  setLibraryDbForTests(db);
  await db.open();
  const read = vi.spyOn(repo, "loadLibrary");
  stops.push(subscribeLibrary(() => {}), subscribeLibrary(() => {}));
  await vi.waitFor(() => expect(readLibrarySnapshot()).toHaveProperty("box"));
  expect(read).toHaveBeenCalledTimes(1);
  const saved = await repo.addToBox({ species: "Garchomp", ability: null, item: null, nature: null, moves: [], spread: null },
    { origin: "manual" });
  expect(saved).not.toBeNull();
  expect(await db.box.count()).toBe(1);
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => {
    const snapshot = readLibrarySnapshot();
    expect(snapshot && snapshot !== "unavailable" ? snapshot.box.length : -1).toBe(1);
  });
  expect(read).toHaveBeenCalledTimes(2);
  for (const stop of stops.splice(0)) stop();
  expect(readLibrarySnapshot()).toBeUndefined();
  await repo.addToBox({ species: "Mimikyu", ability: null, item: null, nature: null, moves: [], spread: null },
    { origin: "manual" });
  stops.push(subscribeLibrary(() => {}));
  await vi.waitFor(() => {
    const snapshot = readLibrarySnapshot();
    expect(snapshot && snapshot !== "unavailable" ? snapshot.box.length : -1).toBe(2);
  });
});
