import { createElement, Suspense } from "react";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { preloadable } from "./preloadable.ts";

const Panel = ({ label }: { label: string }) => createElement("p", null, label);
const module = { default: Panel };

test("intent preloads share one request and the first render does not suspend", async () => {
  let resolve!: (value: typeof module) => void;
  const load = vi.fn(() => new Promise<typeof module>(done => { resolve = done; }));
  const Component = preloadable(load);
  expect(load).not.toHaveBeenCalled();
  const first = Component.preload();
  expect(Component.preload()).toBe(first);
  resolve(module);
  await first;
  expect(await Component.preload()).toBe(module);

  const html = renderToString(createElement(Suspense, { fallback: "loading" },
    createElement(Component, { label: "saved teams" })));
  expect(html).toContain("<p>saved teams</p>");
  expect(html).not.toContain("loading");
  expect(load).toHaveBeenCalledTimes(1);
});

test("an in-flight panel shows its placeholder without suspending and renders when ready", async () => {
  let resolve!: (value: typeof module) => void;
  const load = vi.fn(() => new Promise<typeof module>(done => { resolve = done; }));
  const Component = preloadable(load, "loading");
  const pending = Component.preload();
  const render = () => renderToString(createElement(Suspense, { fallback: "suspended" },
    createElement(Component, { label: "ready" })));
  expect(render()).toContain("loading");
  expect(render()).not.toContain("suspended");
  expect(Component.preload()).toBe(pending);
  resolve(module);
  await pending;
  expect(render()).toContain("<p>ready</p>");
  expect(render()).not.toContain("loading");
  expect(load).toHaveBeenCalledTimes(1);
});

test("a failed intent preload can be retried before the first render", async () => {
  const load = vi.fn<() => Promise<typeof module>>()
    .mockRejectedValueOnce(new Error("chunk unavailable"))
    .mockResolvedValueOnce(module);
  const Component = preloadable(load);
  await expect(Component.preload()).rejects.toThrow("chunk unavailable");
  await Component.preload();
  const html = renderToString(createElement(Suspense, { fallback: "loading" },
    createElement(Component, { label: "retried" })));
  expect(html).toContain("<p>retried</p>");
  expect(html).not.toContain("loading");
  expect(load).toHaveBeenCalledTimes(2);
});
