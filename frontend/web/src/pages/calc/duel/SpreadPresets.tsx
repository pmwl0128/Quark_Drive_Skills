import type { NatureDto } from "@pokemon-champions/protocol";
import { displayName, useLang } from "../../../i18n.ts";
import { useCalcT, type CalcMsgKey } from "../messages.ts";
import { matchesPreset, presetSpread, SP_PRESETS, type PresetSpread, type SpPreset } from "./spPresets.ts";

const LABELS: Record<SpPreset, CalcMsgKey> = {
  fastest: "calc.spPreset.fastest", physical: "calc.spPreset.physical", special: "calc.spPreset.special",
  hp: "calc.spPreset.hp", defense: "calc.spPreset.defense", specialDefense: "calc.spPreset.specialDefense",
};

export function SpreadPresets({ base, build, natures, onPick }: {
  base?: { atk: number; spa: number };
  build: { nature: string; sps: Partial<PresetSpread["sps"]> };
  natures: NatureDto[];
  onPick: (preset: PresetSpread) => void;
}) {
  const t = useCalcT();
  const { lang } = useLang();
  return <div className="stat-presets" role="group" aria-label={t("calc.spPreset.label")}>
    {SP_PRESETS.map(key => {
      const preset = base ? presetSpread(key, base) : null;
      const nature = natures.find(n => n.name === preset?.nature);
      const title = preset ? Object.entries(preset.sps).filter(([, value]) => value > 0)
        .map(([stat, value]) => `${stat.toUpperCase()} ${value}`).join(" · ")
        + ` · ${nature ? displayName(nature, lang) : preset.nature}` : undefined;
      const selected = !!preset && matchesPreset(build, preset);
      return <button key={key} type="button" disabled={!preset} aria-pressed={selected}
        className={selected ? "on" : undefined} title={title}
        onClick={() => { if (preset) onPick(preset); }}>{t(LABELS[key])}</button>;
    })}
  </div>;
}
