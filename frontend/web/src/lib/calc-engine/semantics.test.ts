import { describe, expect, it } from "vitest";
import calcApiRaw from "../../../../../.agents/skills/ncp-damage-calculator/scripts/ncp-calc-api.js?raw";
import { ABILITY_NEEDS_TRIGGER } from "./semantics.ts";

describe("engine semantics mirrored by the page", () => {
  it("offers a trigger switch for exactly the abilities the engine defaults off", () => {
    const declared = /const ABILITY_TOGGLE_OFF = new Set\(\[([^\]]*)\]\)/.exec(calcApiRaw);
    expect(declared, "ABILITY_TOGGLE_OFF not found in the engine wrapper").not.toBeNull();
    const engine = [...(declared?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect([...ABILITY_NEEDS_TRIGGER].sort()).toEqual(engine);
  });
});
