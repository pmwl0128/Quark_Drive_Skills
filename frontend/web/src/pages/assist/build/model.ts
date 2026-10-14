import type { FormatId } from "@pokemon-champions/protocol";

export type Posture = "offense" | "balance" | "defense";

/** A run's brief, as the form held it when it was sent. */
export interface BuildInput {
  format: FormatId;
  posture: Posture;
  anchor: string;
  owned: string;
  avoid: string;
  wants: string[];
  thinking: boolean;
  /** `preview`: the day's model budget was spent, so only the deterministic gates ran. */
  mode?: "preview";
}
