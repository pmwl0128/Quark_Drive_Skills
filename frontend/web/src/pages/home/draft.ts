import { useState } from "react";
import type { FormatId } from "@pokemon-champions/protocol";
import type { BuilderTactic } from "@pokemon-champions/protocol";
import type { BuilderPosture } from "../../lib/builderHandoff.ts";

export type HomeTask = "diagnose" | "build" | "ask";
interface HomeDraft {
  task: HomeTask;
  team: string | null;
  diagnoseFormat: FormatId;
  question: string;
  format: FormatId;
  posture: BuilderPosture;
  anchor: string;
  wants: BuilderTactic[];
}
const KEY = "pc-home-draft-v1";
/** The tactics the home page offers; the wizard has the full list. */
export const HOME_TACTICS = ["weather", "tailwind", "trickroom", "setup"] as const satisfies readonly BuilderTactic[];
const EMPTY: HomeDraft = { task: "diagnose", team: null, diagnoseFormat: "single", question: "", format: "single", posture: "balance", anchor: "", wants: [] };

function read(): HomeDraft {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (!value || typeof value !== "object") return EMPTY;
    return {
      task: value.task === "build" || value.task === "ask" ? value.task : "diagnose",
      team: typeof value.team === "string" ? value.team : null,
      diagnoseFormat: value.diagnoseFormat === "double" ? "double" : "single",
      question: typeof value.question === "string" ? value.question.slice(0, 400) : "",
      format: value.format === "double" ? "double" : "single",
      posture: value.posture === "offense" || value.posture === "defense" ? value.posture : "balance",
      anchor: typeof value.anchor === "string" ? value.anchor.slice(0, 100) : "",
      wants: Array.isArray(value.wants)
        ? value.wants.filter((w: unknown): w is BuilderTactic => typeof w === "string" && HOME_TACTICS.includes(w as never))
        : [],
    };
  } catch { return EMPTY; }
}

/** Write on edit, before navigation can unmount the form. A one-use handoff never consumes the draft. */
export function useHomeDraft<K extends keyof HomeDraft>(key: K): [HomeDraft[K], (value: HomeDraft[K]) => void] {
  const [value, setValue] = useState(() => read()[key]);
  return [value, (next) => {
    setValue(next);
    try { sessionStorage.setItem(KEY, JSON.stringify({ ...read(), [key]: next })); }
    catch { /* Keep the form usable when browser storage is unavailable. */ }
  }];
}
