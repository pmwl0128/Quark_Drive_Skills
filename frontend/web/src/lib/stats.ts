/** Actual stat values at level 50 (IV 31), using the Champions formula: SP (stat points) are
 * added DIRECTLY, capped at 32 per stat — NOT the mainline EV/4 term. This is the game's formula, so
 * it holds for any conforming calc engine; the displayed range is 0 SP up to 32 SP with a boosting
 * nature. */
import type { StatKey, NatureDto } from "@pokemon-champions/protocol";

const LEVEL = 50;

function hpAt(base: number, sp: number): number {
  if (base === 1) return 1;   // base-1 HP (Shedinja) is always exactly 1
  return Math.floor(((2 * base + 31) * LEVEL) / 100) + LEVEL + 10 + sp;
}

function statAt(base: number, sp: number, natureMult: 0.9 | 1 | 1.1): number {
  const raw = Math.floor(((2 * base + 31) * LEVEL) / 100) + 5 + sp;
  return Math.floor(raw * natureMult);
}

/** One stat's actual Lv.50 value from base + SP + nature multiplier (HP ignores nature). Used by
 * the bulk / attack indices (HP×Def, Atk×BP…) that need a single resolved stat, not the range. */
export function actualStat(base: number, key: StatKey, sp: number, natureMult: 0.9 | 1 | 1.1): number {
  return key === "hp" ? hpAt(base, sp) : statAt(base, sp, natureMult);
}

export function natureMultiplier(nature: Pick<NatureDto, "upStat" | "downStat"> | undefined, key: StatKey): 0.9 | 1 | 1.1 {
  if (key === "hp" || !nature || nature.upStat === nature.downStat) return 1;
  return nature.upStat === key ? 1.1 : nature.downStat === key ? 0.9 : 1;
}
