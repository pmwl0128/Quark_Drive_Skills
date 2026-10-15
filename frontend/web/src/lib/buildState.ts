/** Configuration values and transformations shared by editors and calculation workers.
 * Keep this module free of React, hooks, DOM and styles. */
import type { MetaDetailDto, OppSetCatalogDto, OppSetDto } from "@pokemon-champions/protocol";
import { STAT_KEYS } from "@pokemon-champions/protocol";
import type { DexIndexEntry } from "../runtime/adapter.ts";
import type { ItemRef } from "../runtime/projection.ts";
import { dexLookup, megaFor } from "./lookup.ts";

export const STATUSES = [
  "Healthy", "Burned", "Paralyzed", "Poisoned", "Badly Poisoned", "Asleep", "Frozen",
] as const;
export const BOOST_KEYS = ["atk", "def", "spa", "spd", "spe"] as const;

export interface SideState {
  slug: string;
  ability: string;
  item: string;
  nature: string;
  sps: Partial<Record<(typeof STAT_KEYS)[number], number>>;
  status: string;
  boosts: Partial<Record<(typeof BOOST_KEYS)[number], number>>;
  /** Explicit custom/environment picks are complete even when fields are blank. Auto-fill must not
   * replace those deliberate blanks. */
  pinned?: boolean;
}
export const EMPTY_SIDE: SideState = {
  slug: "", ability: "", item: "", nature: "", sps: {}, status: "", boosts: {}, pinned: false,
};

/** Coerce a number input to [lo, hi], treating a cleared/NaN field as `lo` (so wiping a box to retype
 * never propagates NaN into an SP spread and shows dirty verdicts downstream). */
export function clampNum(raw: string, lo: number, hi: number): number {
  const n = Number(raw);
  return Number.isNaN(n) ? lo : Math.max(lo, Math.min(hi, n));
}

export function spSum(sps: SideState["sps"]): number {
  return STAT_KEYS.reduce((n, k) => n + (sps[k] ?? 0), 0);
}

/** Colour bucket for an SP total against the 66-point budget: under-spent / exactly full / illegal. */
export function spSumClass(n: number): string {
  return n > 66 ? "over" : n === 66 ? "full" : "under";
}

/** True when a side carries no user/environment config yet (just a species, or nothing). The auto-fill
 * effects only overwrite a BARE side, so a configured side swapped/pasted in keeps its build while a
 * fresh pick (or a species switch, which resets to EMPTY_SIDE) still gets its environment fill. */
export function sideIsBare(s: SideState): boolean {
  return !s.pinned && !s.ability && !s.item && !s.nature && !s.status
    && !Object.keys(s.sps).length && !Object.keys(s.boosts).length;
}

// Boost stages high→low so the dropdown reads +6 … 0 … −6 top-to-bottom.
export const BOOST_STAGES = [6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6] as const;
export const boostLabel = (n: number): string => (n > 0 ? `+${n}` : String(n));

export interface ModalSet {
  ability: string;
  item: string;
  nature: string;
  sps: Partial<Record<(typeof STAT_KEYS)[number], number>>;
  moves: string[];
}

/** One concrete choice shown by the environment-build picker. Observed configurations keep their
 * joint item/ability/nature/moves/SP fields intact; the old marginal-mode Meta stitch is appended
 * only as an explicit fallback. */
export interface BuildOption {
  key: string;
  source: "aggregate" | "meta";
  coverage: number | null;
  isModal: boolean;
  modal: ModalSet;
  set: OppSetDto;
}

/** Convert one drawer/environment card into a calculator side. A null option is the deliberately
 * blank Custom card, so both paths are pinned against background environment auto-fill. */
export function sideFromBuild(slug: string, option: BuildOption | null): SideState {
  if (!option) return { ...EMPTY_SIDE, slug, sps: {}, boosts: {}, pinned: true };
  return {
    ...EMPTY_SIDE,
    slug,
    ability: option.modal.ability,
    item: option.modal.item,
    nature: option.modal.nature,
    sps: { ...option.modal.sps },
    boosts: {},
    pinned: true,
  };
}

/** Apply facts that belong to the literal dex form selected by the user. Meta detail falls back
 * from a Mega form to its ranked base species, so its stitched modal set can carry the base
 * ability. The stone is form-specific already; the ability must be form-specific too or an
 * explicit Mega Salamence request silently reaches the engine without Aerilate. */
export function modalForEntry(modal: ModalSet, entry: DexIndexEntry | undefined,
                              stone: ItemRef | undefined): ModalSet {
  return {
    ...modal,
    ...(stone ? { item: stone.name } : {}),
    ...(entry?.isMega ? { ability: entry.abilities[0]?.name ?? "" } : {}),
  };
}

/** A convenience STARTING build for the calc tools, stitched from a mon's meta panels: the top
 * ability / item / nature / SP spread + top-4 damaging moves, each the marginal mode of its own
 * panel. These fields have NO joint-distribution guarantee — this combination may never have been
 * played together (dev/design.md §8 forbids treating such a stitch as a real set). It exists only to
 * seed the form so the user isn't typing from scratch; the UI labels it as an unverified default
 * (calc.fillDisclaimer) and the user is expected to adjust. Precise tuning routes through the skill
 * `tune` operator, which grounds on real joint samples instead. */
export function toModalSet(d: MetaDetailDto): ModalSet {
  return {
    ability: d.panels.abilities[0]?.name ?? "",
    item: d.panels.items[0]?.name ?? "",
    nature: d.panels.natures[0]?.name ?? "",
    sps: { ...(d.panels.spreads[0]?.spread ?? {}) },
    moves: d.panels.moves.filter((m) => m.category !== "Status").slice(0, 4).map((m) => m.name),
  };
}

/** Signature of a side's auto-fillable fields + its picked move(s). Two sides with the same signature
 * are indistinguishable to the auto-fill, so on a FORMAT switch a side still matching its last auto-fill
 * (the user never edited it) can be safely re-filled from the new format's modal set, while a user-edited
 * or swapped-in side is left alone. This replaces the `sideIsBare` heuristic, which couldn't tell an
 * unedited auto-fill from a deliberate build and so froze the wrong-format set on a switch (audit 2026-07-14). */
export function autofillSig(s: SideState, moves: string[] = []): string {
  const sps = STAT_KEYS.map((k) => `${k}:${s.sps[k] ?? 0}`).join(",");
  const boosts = BOOST_KEYS.map((k) => `${k}:${s.boosts[k] ?? 0}`).join(",");
  return JSON.stringify([s.ability, s.item, s.nature, sps, s.status, boosts, moves]);
}

/** The signature a side WOULD carry right after an auto-fill from `m` with `moves` — compare a live
 * side against this (via autofillSig) to tell whether it still holds an untouched auto-fill. */
export function modalSig(m: ModalSet, moves: string[]): string {
  return autofillSig(
    { slug: "", ability: m.ability, item: m.item, nature: m.nature, sps: m.sps, status: "", boosts: {} },
    moves);
}

/** Identity of the configuration printed on a build card. Battle-only state (status, current HP,
 * boosts) is deliberately absent: changing the current turn must not relabel an otherwise exact
 * environment build as custom. Four fixed move slots make a two-move build different from the
 * same prefix with a third hand-edited move. */
export function buildConfigSig(build: {
  ability: string;
  item: string;
  nature: string;
  sps: Partial<Record<(typeof STAT_KEYS)[number], number>>;
  moves: string[];
}): string {
  const moves = [...build.moves.slice(0, 4)];
  while (moves.length < 4) moves.push("");
  return JSON.stringify([
    build.ability,
    build.item,
    build.nature,
    STAT_KEYS.map((key) => build.sps[key] ?? 0),
    moves,
  ]);
}

/** Engine-facing view of a side: the Mega form (with its own legal ability) when the held
 * stone matches, else the side as-is. `entry` is what the request should be issued for. */
export function withMega<S extends { slug: string; item: string }>(
  s: S, dex: DexIndexEntry[], items: ItemRef[],
): { state: S; entry: DexIndexEntry | undefined; mega: boolean } {
  const base = dexLookup(dex).bySlug.get(s.slug);
  const mega = base?.isMega ? base : megaFor(s.slug, s.item, dex, items);
  if (!mega) return { state: s, entry: base, mega: false };
  const state = { ...s };
  const withAbility = state as S & { ability?: string };
  if ("ability" in state && withAbility.ability !== undefined
      && !mega.abilities.some((a) => a.name === withAbility.ability)) {
    withAbility.ability = mega.abilities[0]?.name ?? "";
  }
  return { state, entry: mega, mega: true };
}

function modalFromObserved(set: OppSetDto): ModalSet {
  return {
    ability: set.ability ?? "",
    item: set.item ?? "",
    nature: set.nature ?? "",
    sps: { ...(set.sps ?? {}) },
    moves: [...(set.moves ?? [])].slice(0, 4),
  };
}

/** Convert the lightweight opponent-set catalog into the calculator's ordered choices. The source
 * rows are already modal-first, but sorting here makes the user-facing contract independent of
 * serialization order: highest observed share wins every automatic fill. */
export function observedBuildOptions(
  catalog: OppSetCatalogDto | null,
  slug: string,
  dex: DexIndexEntry[],
  items: ItemRef[],
): BuildOption[] {
  if (!catalog) return [];
  const entry = dex.find((e) => e.slug === slug);
  const base = entry?.isMega && entry.baseSpecies
    ? dex.find((e) => e.name === entry.baseSpecies) : entry;
  const row = catalog.species.find((s) => s.slug === (base?.slug ?? slug));
  if (!row) return [];
  const stone = entry?.isMega
    ? items.find((i) => i.requiredBy?.includes(entry.name)) : undefined;
  return [...(row.variants ?? [])]
    .map((variant) => ({ variant, set: catalog.sets[variant.key] }))
    .filter((pair): pair is { variant: NonNullable<typeof pair.variant>; set: OppSetDto } =>
      !!pair.set && (!entry?.isMega || pair.set.runForm === entry.name))
    .sort((a, b) => (b.variant.coverage ?? -1) - (a.variant.coverage ?? -1)
      || Number(b.variant.isModal) - Number(a.variant.isModal))
    .map(({ variant, set }) => {
      const modal = modalForEntry(modalFromObserved(set), entry, stone);
      return {
        key: variant.key,
        source: "aggregate" as const,
        coverage: variant.coverage ?? set.coverage ?? null,
        isModal: variant.isModal,
        modal,
        set: {
          ...set,
          ability: modal.ability || null,
          item: modal.item || null,
          nature: modal.nature || null,
          moves: modal.moves,
          sps: modal.sps,
        },
      };
    });
}
