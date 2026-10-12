/** Engine behaviour the page has to mirror without running the engine.
 *
 * Everything here restates a choice the vendored calc engine makes, so it lives next to the engine
 * client rather than in the pages that read it: swapping the engine (dev/calc-migration.md P4) then
 * means revisiting this folder only. `semantics.test.ts` pins each copy to the engine source. */

/** Abilities the engine ships toggled OFF because their trigger is invisible to a single damage frame,
 * so "it went off" is the caller's statement rather than a default. This copy only decides when the
 * page OFFERS the switch — the engine's own list owns the behaviour, and if the two ever drift the cost
 * is a switch that is not offered, never a number computed from a wrong flag. */
export const ABILITY_NEEDS_TRIGGER: ReadonlySet<string> = new Set([
  "Flash Fire", "Plus", "Minus", "Trace", "Stakeout", "Sand Spit", "Battle Bond",
  "Electromorphosis", "Wind Power", "Seed Sower",
]);
