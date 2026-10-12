/** The home page's builder brief across a navigation: format, playstyle, core and tactics are chosen
 * there and the wizard opens with them filled, the rest of its form left as the reader had it. Same
 * one-trip rule as the diagnose hand-off; kept out of BuilderPage so the home page can stash a brief
 * without loading the wizard. */
import type { BuilderTactic, FormatId } from "@pokemon-champions/protocol";

const BUILDER_FILL_KEY = "pc-builder-fill-v1";

export type BuilderPosture = "offense" | "balance" | "defense";

/** The protocol's tactic vocabulary, restated as a type-checked literal so the home page validates a
 * stored brief without importing the protocol's runtime schemas into its chunk. */
const TACTICS: readonly BuilderTactic[] = [
  "stall", "trickroom", "weather", "tailwind", "screens", "pivot", "setup", "hazards",
];
const isTactic = (value: unknown): value is BuilderTactic => TACTICS.includes(value as BuilderTactic);

export interface BuilderFill {
  format: FormatId;
  posture: BuilderPosture;
  /** As typed; the wizard resolves it through the dex when the job starts. */
  anchor: string;
  wants: BuilderTactic[];
}

export function stashBuilderFill(fill: BuilderFill): void {
  try {
    sessionStorage.setItem(BUILDER_FILL_KEY, JSON.stringify(fill));
  } catch { /* storage blocked — the wizard just opens on its own form */ }
}

/** Read AND CLEAR, like every hand-off: one trip only. */
export function takeBuilderFill(): BuilderFill | null {
  try {
    const raw = sessionStorage.getItem(BUILDER_FILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(BUILDER_FILL_KEY);
    const fill = JSON.parse(raw) as Partial<BuilderFill>;
    return {
      format: fill.format === "double" ? "double" : "single",
      posture: fill.posture === "offense" || fill.posture === "defense" ? fill.posture : "balance",
      anchor: typeof fill.anchor === "string" ? fill.anchor.slice(0, 100) : "",
      wants: Array.isArray(fill.wants) ? [...new Set(fill.wants.filter(isTactic))] : [],
    };
  } catch {
    return null;
  }
}
