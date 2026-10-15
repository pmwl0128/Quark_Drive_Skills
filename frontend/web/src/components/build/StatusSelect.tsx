import { STATUS_ICONS } from "../../assets/status.ts";
import { AdaptiveSelect } from "../AdaptiveSelect.tsx";
import { useSharedT } from "../messages.ts";
import { STATUSES } from "../../lib/buildState.ts";

export function StatusSelect({ value, onChange }: { value: string; onChange: (status: string) => void }) {
  const t = useSharedT();
  return <AdaptiveSelect value={value} onValueChange={onChange} optionIcon={status => {
    const icon = STATUS_ICONS[status];
    return icon ? <img src={icon} alt="" /> : null;
  }}>
    {STATUSES.map(status => <option key={status} value={status === "Healthy" ? "" : status}>{t(`status.${status}`)}</option>)}
  </AdaptiveSelect>;
}
