import { describe, expect, it } from "vitest";
import { matchesPreset, presetSpread, type SpPreset } from "./spPresets.ts";

const physical = { atk: 130, spa: 80 };
const special = { atk: 80, spa: 130 };

describe("battle SP shortcuts", () => {
  it.each<[SpPreset, typeof physical, string, number[]]>([
    ["fastest", physical, "Jolly", [2, 32, 0, 0, 0, 32]],
    ["physical", physical, "Adamant", [2, 32, 0, 0, 0, 32]],
    ["special", physical, "Modest", [2, 0, 0, 32, 0, 32]],
    ["hp", physical, "Adamant", [32, 32, 0, 0, 0, 2]],
    ["defense", physical, "Impish", [32, 0, 32, 0, 0, 2]],
    ["specialDefense", physical, "Careful", [32, 0, 0, 0, 32, 2]],
    ["fastest", special, "Timid", [2, 0, 0, 32, 0, 32]],
    ["hp", special, "Modest", [32, 0, 0, 32, 0, 2]],
    ["defense", special, "Bold", [32, 0, 32, 0, 0, 2]],
    ["specialDefense", special, "Calm", [32, 0, 0, 0, 32, 2]],
  ])("%s uses the requested spread and nature for %j", (preset, base, nature, values) => {
    const result = presetSpread(preset, base);
    const [hp, atk, def, spa, spd, spe] = values;
    expect(result).toEqual({ nature, sps: { hp, atk, def, spa, spd, spe } });
    expect(Object.values(result.sps).reduce((sum, value) => sum + value, 0)).toBe(66);
  });

  it("prefers the special orientation on ties for speed, HP and both defences", () => {
    for (const preset of ["fastest", "hp", "defense", "specialDefense"] as const) {
      expect(presetSpread(preset, { atk: 100, spa: 100 })).toEqual(presetSpread(preset, special));
    }
  });

  it("derives selection from every SP axis and nature, including externally edited builds", () => {
    const preset = presetSpread("physical", physical);
    expect(matchesPreset({ nature: "Adamant", sps: { hp: 2, atk: 32, spe: 32 } }, preset)).toBe(true);
    expect(matchesPreset({ nature: "Jolly", sps: preset.sps }, preset)).toBe(false);
    expect(matchesPreset({ ...preset, sps: { ...preset.sps, atk: 31 } }, preset)).toBe(false);
    expect(matchesPreset({ ...preset, sps: { ...preset.sps, def: 1 } }, preset)).toBe(false);
    expect(matchesPreset({ ...preset, sps: { ...preset.sps } }, preset)).toBe(true);
  });
});
