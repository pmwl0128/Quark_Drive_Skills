import { STAT_KEYS } from "@pokemon-champions/protocol";
import { SP_BUDGET, SP_MAX } from "../../../lib/battle.ts";

export const SP_PRESETS = ["fastest", "physical", "special", "hp", "defense", "specialDefense"] as const;
export type SpPreset = typeof SP_PRESETS[number];
type Stat = typeof STAT_KEYS[number];
export interface PresetSpread { nature: string; sps: Record<Stat, number> }

/** Compare the effective form's base offences; existing investment/nature never changes the preset. */
export function presetSpread(preset: SpPreset, base: { atk: number; spa: number }): PresetSpread {
  const physical = base.atk > base.spa;
  const offense = physical ? "atk" : "spa";
  const sps = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const speed = preset === "fastest" || preset === "physical" || preset === "special";
  const primary = preset === "physical" ? "atk" : preset === "special" ? "spa"
    : preset === "defense" ? "def" : preset === "specialDefense" ? "spd" : offense;
  sps[primary] = SP_MAX;
  sps[speed ? "spe" : "hp"] = SP_MAX;
  sps[speed ? "hp" : "spe"] = SP_BUDGET - 2 * SP_MAX;
  const nature = preset === "fastest" ? physical ? "Jolly" : "Timid"
    : preset === "physical" ? "Adamant" : preset === "special" ? "Modest"
      : preset === "defense" ? physical ? "Impish" : "Bold"
        : preset === "specialDefense" ? physical ? "Careful" : "Calm"
          : physical ? "Adamant" : "Modest";
  return { nature, sps };
}

/** Identity comes from the live build, including all six axes, regardless of how it was entered. */
export function matchesPreset(build: { nature: string; sps: Partial<Record<Stat, number>> }, preset: PresetSpread): boolean {
  return build.nature === preset.nature && STAT_KEYS.every(key => (build.sps[key] ?? 0) === preset.sps[key]);
}
