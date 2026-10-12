import { expect, test, vi } from "vitest";

vi.mock("./projection.ts", () => ({
  loadCards: async () => [
    { name: "Indeedee", nameJa: "イエッサン" },
    { name: "Indeedee-F", nameJa: "イエッサン（メスのすがた）" },
    { name: "Garchomp", nameJa: "ガブリアス" },
  ],
  loadProjectionDexIndex: async () => [],
}));

const { OnlineAdapter } = await import("./online.ts");

test("the static resolver never settles a shared substring on one form", async () => {
  const adapter = new OnlineAdapter({ runtime: "online", projectionBase: "/p", apiBase: "/api" });
  const [shared, unique, exact, blank] = await adapter.resolve(["イエッサ", "Garch", "イエッサン", " "]);
  expect(shared).toMatchObject({ ok: false, matchType: "ambiguous", suggestions: ["Indeedee", "Indeedee-F"] });
  expect(unique).toMatchObject({ ok: true, canonical: "Garchomp", matchType: "fuzzy" });
  expect(exact).toMatchObject({ ok: true, canonical: "Indeedee", matchType: "exact" });
  expect(blank).toMatchObject({ ok: false, matchType: null });
});
