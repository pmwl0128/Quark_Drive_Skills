/** Pure durability model: loaded spreads, survival targets, arithmetic over the engine's rolls
 * and request identities. The React request cache lives in useDamageStore.ts. */
import type { DamageRequestDto, TuneCardDto } from "@pokemon-champions/protocol";
import type { MonState } from "../duel/state.ts";

export type TuneSide = "mine" | "foe";
export type Hits = 1 | 2;
/** The `tune` operator's probability vocabulary, strongest first. */
export type GoalTarget = "guaranteed" | "near_guaranteed" | "likely" | "three_quarters" | "half";
export type BulkStat = "hp" | "def" | "spd";

/** The spread a mon arrived with (import, environment build, first sight) — what 还原 restores. */
export interface Baseline {
  sps: MonState["sps"];
  nature: string;
}

/** One pinned "survive THIS move from THIS attacker" requirement. */
export interface Goal {
  id: string;
  mineId: string;
  foeId: string;
  move: string;
  hits: Hits;
  target: GoalTarget;
}

export const TARGETS: Array<{ id: GoalTarget; probability: number }> = [
  { id: "guaranteed", probability: 1 },
  { id: "near_guaranteed", probability: 15 / 16 },
  { id: "likely", probability: 13 / 16 },
  { id: "three_quarters", probability: 12 / 16 },
  { id: "half", probability: 8 / 16 },
];

export const targetProbability = (target: GoalTarget): number =>
  TARGETS.find((candidate) => candidate.id === target)?.probability ?? 1;

/** Special moves that the engine resolves against Def: the SP that moves their cliff is Def. */
const PHYS_DEF_SPECIAL_MOVES = new Set(["Psyshock", "Psystrike", "Secret Sword"]);

/** The defensive stat a damaging move presses on, or null for a status move. */
export function pressedStat(move: string, category: string | undefined): "def" | "spd" | null {
  if (category === "Physical") return "def";
  if (category === "Special") return PHYS_DEF_SPECIAL_MOVES.has(move) ? "def" : "spd";
  return null;
}

export const cloneSps = (sps: MonState["sps"]): MonState["sps"] => ({ ...sps });

// -- attack index --------------------------------------------------------------------------

/** Type-boost items in the pool (dex category `type_boost`, x1.2 on their type). */
const TYPE_BOOST_ITEM: Record<string, string> = {
  "Black Belt": "Fighting", "Black Glasses": "Dark", "Charcoal": "Fire", "Dragon Fang": "Dragon",
  "Fairy Feather": "Fairy", "Hard Stone": "Rock", "Magnet": "Electric", "Metal Coat": "Steel",
  "Miracle Seed": "Grass", "Mystic Water": "Water", "Never-Melt Ice": "Ice", "Poison Barb": "Poison",
  "Sharp Beak": "Flying", "Silk Scarf": "Normal", "Silver Powder": "Bug", "Soft Sand": "Ground",
  "Spell Tag": "Ghost", "Twisted Spoon": "Psychic",
};

/** The holder's own power item, as the attack index models it. Effectiveness-gated (Expert Belt) and
 * one-shot items (gems, berries) are left out: they are not a property of the attacker alone. */
function itemPower(item: string, physical: boolean, moveType: string): number {
  let power = 1;
  if (item === "Life Orb") power *= 1.3;
  else if (item === "Muscle Band" && physical) power *= 1.1;
  else if (item === "Wise Glasses" && !physical) power *= 1.1;
  if (TYPE_BOOST_ITEM[item] === moveType) power *= 1.2;
  return power;
}

/** The attack index of one move: 0.44 x attacking stat (stage applied) x power x STAB x item x burn —
 * the lead term of the level-50 damage formula, on the same scale as a bulk index (HP x Def): an index
 * about equal to the bulk puts the max roll near 100%, about half of it is the two-hit line. Type
 * effectiveness, weather, terrain and abilities are deliberately not in it. */
export function attackIndex(stat: number, move: { power?: number | null; type: string; category: string },
  types: string[], item: string, burned: boolean): number | null {
  if (!move.power || !stat) return null;
  const physical = move.category === "Physical";
  const stab = types.includes(move.type) ? 1.5 : 1;
  const burn = physical && burned ? 0.5 : 1;
  return Math.round(0.44 * stat * move.power * stab * burn * itemPower(item, physical, move.type));
}

// -- survival ------------------------------------------------------------------------------

/** The slice of an engine result this page reads. Kept small because the store holds thousands. */
export interface Rolls {
  damage: number[];
  defenderHP: number;
  min: number;
  max: number;
  minPercent: number;
  maxPercent: number;
  category: string;
  isSpread?: boolean;
  /** The engine reports one hit of a multi-hit move, not the total. */
  multiHit?: boolean;
}

export interface Survival {
  alive: number;
  total: number;
  probability: number;
}

export function survival(rolls: Rolls | null, hits: Hits): Survival {
  const damage = rolls?.damage ?? [];
  const hp = rolls?.defenderHP ?? 0;
  if (!damage.length || hp <= 0) return { alive: 0, total: 0, probability: 0 };
  let alive = 0;
  let total = 0;
  if (hits === 1) {
    for (const value of damage) { total++; if (value < hp) alive++; }
  } else {
    // Independent rolls on both hits, the same model the `tune` operator's two-hit tier uses.
    for (const first of damage) for (const second of damage) {
      total++;
      if (first + second < hp) alive++;
    }
  }
  return { alive, total, probability: alive / total };
}

/** Per first-hit roll, the share of outcomes survived: 0 or 1 for one hit, the fraction of second
 * rolls that still leave the defender standing for two. Drives the roll strip's fill. */
export function rollSurvival(rolls: Rolls | null, hits: Hits): number[] {
  const damage = rolls?.damage ?? [];
  const hp = rolls?.defenderHP ?? 0;
  if (hits === 1) return damage.map((value) => (value < hp ? 1 : 0));
  return damage.map((first) =>
    damage.filter((second) => first + second < hp).length / damage.length);
}

export function formatProbability(value: number): string {
  return `${Number((value * 100).toFixed(2))}%`;
}

// -- solver lanes ----------------------------------------------------------------------

export type Spread = MonState["sps"];

/** One operator allocation lane as an absolute spread: the solved-from base with the lane's
 * totals written on top, so applying it never stacks on an earlier apply. */
export interface Lane {
  kind: string;
  result: string;
  delta: number;
  spread: Spread;
  changed: Array<{ stat: string; from: number; to: number }>;
  donors: Array<{ stat: string; current_sp: number }>;
}

export function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

/** The operator's allocation lanes, turned into absolute spreads over the solved-from base. */
export function lanesOf(card: TuneCardDto, base: Spread): Lane[] {
  const lanes = Array.isArray(card.allocation_lanes) ? card.allocation_lanes : [];
  return lanes.flatMap((raw) => {
    const lane = record(raw);
    if (!lane) return [];
    const kind = String(lane.lane ?? lane.stat ?? "");
    const result = String(lane.result ?? "");
    const delta = num(lane.delta_sp) ?? 0;
    const totals: Record<string, number> = {};
    const allocation = record(lane.allocation);
    if (allocation) {
      for (const [stat, part] of Object.entries(allocation)) {
        const need = num(record(part)?.need_total);
        if (need !== null) totals[stat] = need;
      }
    } else {
      const need = num(lane.need_total);
      if (need !== null && kind) totals[kind] = need;
    }
    if (!Object.keys(totals).length) return [];
    const spread: Spread = { ...base };
    const changed = Object.entries(totals).map(([stat, to]) => {
      const key = stat as keyof Spread;
      const from = base[key] ?? 0;
      spread[key] = to;
      return { stat, from, to };
    });
    const donors = (record(lane.reallocation)?.candidate_donors as unknown[] | undefined ?? [])
      .flatMap((donor) => {
        const row = record(donor);
        const stat = row && typeof row.stat === "string" ? row.stat : null;
        const current = row ? num(row.current_sp) : null;
        return stat && current ? [{ stat, current_sp: current }] : [];
      });
    return [{ kind, result, delta, spread, changed, donors }];
  });
}

export const requestKey = (request: DamageRequestDto): string => JSON.stringify(request);
