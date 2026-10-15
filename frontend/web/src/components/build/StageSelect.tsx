import { BOOST_STAGES, boostLabel } from "../../lib/buildState.ts";
import { AdaptiveSelect } from "../AdaptiveSelect.tsx";

/** Shared stage selector: neutral, raised and lowered stats keep the same visual language. */
export function StageSelect({ value, label, onChange }: {
  value: number;
  label: string;
  onChange: (stage: number) => void;
}) {
  return (
    <AdaptiveSelect compact className={`tw-stage-sel num${value > 0 ? " up" : value < 0 ? " down" : ""}`} value={value}
      aria-label={label} title={label} onValueChange={(value) => onChange(Number(value))}>
      {BOOST_STAGES.map((stage) => <option key={stage} value={stage}>{boostLabel(stage)}</option>)}
    </AdaptiveSelect>
  );
}
