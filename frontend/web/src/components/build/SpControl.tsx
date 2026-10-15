import type { CSSProperties } from "react";
import { clampNum } from "../../lib/buildState.ts";
import { SP_MAX } from "../../lib/battle.ts";
import "./styles.sp.css";

/** A numeric investment and its draggable meter are two controls for the same SP value. */
export function SpControl({ stat, value, baseline, shortcuts = true, onChange }: {
  stat: string; value: number; onChange: (value: number) => void;
  shortcuts?: boolean;
  /** The loaded spread's position, shown once the investment changes. */
  baseline?: number;
}) {
  const label = `${stat} SP`;
  const tone = value < 8 ? "low" : value < 24 ? "mid" : "high";
  return <div className={`stat-sp-control${shortcuts ? "" : " plain"}`}>
    <span className="stat-sp-capsule">
      {shortcuts && <button type="button" aria-label={`${label}: 0`} onClick={() => onChange(0)}>min</button>}
      <input type="number" min={0} max={SP_MAX} step={1} inputMode="numeric" className="num"
        value={value} aria-label={label} onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(clampNum(event.target.value, 0, SP_MAX))} />
      {shortcuts && <button type="button" aria-label={`${label}: ${SP_MAX}`} onClick={() => onChange(SP_MAX)}>max</button>}
    </span>
    <span className={`stat-sp-meter ${tone}`} style={{
      "--sp-fill": `${value / SP_MAX * 100}%`, "--sp-baseline": `${(baseline ?? 0) / SP_MAX * 100}%`,
    } as CSSProperties}>
      <span className="stat-sp-track" aria-hidden><span className="stat-sp-fill" /></span>
      {baseline !== undefined && baseline !== value && <span className="stat-sp-baseline" aria-hidden />}
      <input type="range" min={0} max={SP_MAX} step={1} value={value} aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))} />
    </span>
  </div>;
}
