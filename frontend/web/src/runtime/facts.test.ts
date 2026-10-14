import { expect, test } from "vitest";
import { AsyncFacts } from "./adapter.ts";

test("parallel readers share a fact and a failed lookup can retry", async () => {
  const cache = new AsyncFacts<string>();
  let calls = 0;
  let resolve!: (value: string) => void;
  const make = () => { calls++; return new Promise<string>(done => { resolve = done; }); };
  const first = cache.get("single:x", make);
  const second = cache.get("single:x", make);
  expect(calls).toBe(1);
  resolve("single");
  expect(await Promise.all([first, second])).toEqual(["single", "single"]);
  await expect(cache.get("double:x", () => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
  expect(await cache.get("double:x", async () => "double")).toBe("double");
});

test("bounded ready facts do not evict a pending shared request", async () => {
  const cache = new AsyncFacts<number>(1);
  let resolve!: (value: number) => void;
  const pending = cache.get("pending", () => new Promise<number>(done => { resolve = done; }));
  await cache.get("old", async () => 1);
  await cache.get("new", async () => 2);
  expect(cache.get("pending", async () => 99)).toBe(pending);
  expect(await cache.get("old", async () => 3)).toBe(3);
  resolve(4);
  expect(await pending).toBe(4);
});
