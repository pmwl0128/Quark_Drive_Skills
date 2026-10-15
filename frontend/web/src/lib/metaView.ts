/** Which metagame a ranking/detail page shows, and whether it compares against the other one.
 *
 * Two populations share the same fields: the in-game metagame (the whole ranked ladder) and Top Meta
 * (the collected real teams). Each Top Meta record carries both sides, and `delta` / `rankDelta`
 * are written once as "Top Meta relative to in-game". A view reads them as "this view relative to
 * the other one", so the in-game view negates them — the same reading as the change column, which
 * is "this period relative to the window's first period". */
import type { TopMetaScopeId } from "@pokemon-champions/protocol";

export type MetaSource = "ingame" | "top";

export interface MetaView {
  source: MetaSource;
  /** Top Meta only: the current season, or every season of the current rule. The rule scope compares
   * with the current official snapshot, so its two sides cover different time ranges. */
  scope: TopMetaScopeId;
  compare: boolean;
}

const compareByDefault = (source: MetaSource) => source === "top";

export function readMetaView(params: URLSearchParams): MetaView {
  const source: MetaSource = params.get("src") === "top" ? "top" : "ingame";
  const scope: TopMetaScopeId = source === "top" && params.get("scope") === "rule" ? "rule" : "season";
  // The Top Meta view exists to show where it differs, so its comparison starts on; the in-game view
  // keeps its usual change column until the reader asks for the comparison.
  const cmp = params.get("cmp");
  const compare = cmp === null ? compareByDefault(source) : cmp === "1";
  return { source, scope, compare };
}

export function withMetaView(params: URLSearchParams, next: Partial<MetaView>): URLSearchParams {
  const current = readMetaView(params);
  const source = next.source ?? current.source;
  const scope = source === "top" ? next.scope ?? current.scope : "season";
  // Switching the source starts that view at its own default rather than carrying a choice made
  // for the other view's column.
  const compare = next.compare ?? (source === current.source ? current.compare : compareByDefault(source));
  const out = new URLSearchParams(params);
  if (source === "top") out.set("src", "top"); else out.delete("src");
  if (scope === "rule") out.set("scope", "rule"); else out.delete("scope");
  if (compare === compareByDefault(source)) out.delete("cmp"); else out.set("cmp", compare ? "1" : "0");
  return out;
}

/** The view's own params, for links that should open the same view on another page. */
export function metaViewQuery(params: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const key of ["src", "scope", "cmp"]) {
    const value = params.get(key);
    if (value !== null) out.set(key, value);
  }
  const text = out.toString();
  return text ? `&${text}` : "";
}

/** A Top-Meta-relative difference read from the given view. */
export function fromView(delta: number | null | undefined, source: MetaSource): number | null {
  return delta == null ? null : source === "top" ? delta : -delta;
}
