/** "Diagnose this team" across a navigation. The diagnose tab lives on the assist page, so the team
 * crosses a route change instead of sibling-tab state: a structured team from a result or the library,
 * or the raw text someone pasted on the home page. Kept apart from lib/team.ts so the home page can
 * hand text over without loading the team readers. */
import type { FormatId } from "@pokemon-champions/protocol";

const DIAGNOSE_FILL_KEY = "pc-diagnose-fill-v1";

/** Raw pasted text; the diagnose form parses it like anything typed there. */
interface DiagnoseTextFill { handoff: "text"; text: string; format?: FormatId }

export const isDiagnoseTextFill = (fill: unknown): fill is DiagnoseTextFill =>
  typeof fill === "object" && fill !== null && (fill as { handoff?: unknown }).handoff === "text"
  && typeof (fill as { text?: unknown }).text === "string";

export function stashDiagnoseFill(team: unknown): void {
  try {
    sessionStorage.setItem(DIAGNOSE_FILL_KEY, JSON.stringify(team));
  } catch { /* storage blocked — the diagnose tab just opens on its own form */ }
}

export function stashDiagnoseText(text: string, format?: FormatId): void {
  stashDiagnoseFill({ handoff: "text", text, format } satisfies DiagnoseTextFill);
}

/** Read AND CLEAR, like every hand-off: one trip only. */
export function takeDiagnoseFill(): unknown | null {
  try {
    const raw = sessionStorage.getItem(DIAGNOSE_FILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(DIAGNOSE_FILL_KEY);
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
