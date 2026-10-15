import { afterEach, expect, test, vi } from "vitest";
import { OnlineAdapter } from "./online.ts";
import { LocalAdapter } from "./local.ts";

afterEach(() => { vi.unstubAllGlobals(); });

const detail = { format: "single", matrix: {
  "variant:a|one": { b: { offense: null, speed: { attacker: 100, defender: 90, faster: "attacker" } } },
  b: { "variant:a|one": { offense: null, speed: { attacker: 90, defender: 100, faster: "defender" } } },
} };

test("both adapters validate the same bounded detail shape and preserve opaque variant keys", async () => {
  const fetcher = vi.fn(async (_url: string) => new Response(JSON.stringify(detail)));
  vi.stubGlobal("fetch", fetcher);
  const online = new OnlineAdapter({ runtime: "online", projectionBase: "/projection", apiBase: "/api" });
  const local = new LocalAdapter({ runtime: "local", projectionBase: "/projection", apiBase: "/api" });
  expect(await online.oppDetails("single", "a")).toEqual(detail);
  expect(await local.oppDetails("single", "a")).toEqual(detail);
  expect(String(fetcher.mock.calls[0]?.[0])).toContain("/matchup/details_single/a.json");
  expect(String(fetcher.mock.calls[1]?.[0])).toBe("/api/team/oppcache?format=single&view=details&species=a");
  fetcher.mockImplementation(async () => new Response(JSON.stringify({ ...detail, matrix: { a: null } })));
  await expect(online.oppDetails("single", "a")).rejects.toThrow();
});

test("expired detail shards load native facts and refuse absent native evidence", async () => {
  let native: unknown = detail;
  const paths: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    paths.push(url);
    return new Response(JSON.stringify(url.includes(".native.json") ? native : {
      ...detail, teamEvidenceExpiresAt: "2000-01-01T00:00:00Z",
    }));
  });
  const adapter = new OnlineAdapter({ runtime: "online", projectionBase: "/projection", apiBase: "/api" });
  expect(await adapter.oppDetails("single", "a")).toEqual(detail);
  expect(paths.map(path => path.split("?")[0])).toEqual([
    "/projection/matchup/details_single/a.json", "/projection/matchup/details_single/a.native.json",
  ]);
  native = { available: false };
  await expect(adapter.oppDetails("single", "a")).rejects.toMatchObject({ status: 404 });
});
