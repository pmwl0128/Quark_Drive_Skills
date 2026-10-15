import type { NatureDto } from "@pokemon-champions/protocol";
import { useMemo } from "react";
import { AdaptiveCombobox } from "../AdaptiveCombobox.tsx";
import { displayName, useLang } from "../../i18n.ts";
import { useSharedT } from "../messages.ts";
import { shareLabel, splitByUsage, type MetaUsage } from "../../lib/metaUsage.ts";
import { natureLabel, natureOrder } from "../../lib/buildLabels.ts";
import { useLocalizedDraft } from "./useLocalizedDraft.ts";
import "./styles.nature.css";

/** The same searchable picker as items, with nature modifiers and metagame ordering preserved. */
export function NatureCombo({ value, onChange, natures, usage }: {
  value: string;
  onChange: (canonical: string) => void;
  natures: readonly NatureDto[];
  usage: MetaUsage | null;
}) {
  const { lang } = useLang();
  const t = useSharedT();
  const current = natures.find((nature) => nature.name === value);
  const selectedLabel = current ? displayName(current, lang) : value;
  const [text, setText, resetText] = useLocalizedDraft(value, selectedLabel, lang);
  const options = useMemo(() => {
    const { meta, rest } = splitByUsage(natures, (nature) => nature.name, usage?.natures);
    const option = (nature: NatureDto) => {
      const name = displayName(nature, lang);
      const modified = nature.upStat && nature.downStat && nature.upStat !== nature.downStat;
      return {
        key: nature.name, value: name,
        searchText: `${nature.name} ${nature.nameZh ?? ""} ${nature.nameJa ?? ""} ${natureLabel(nature, lang)}`,
        label: <span className="nature-option">
          <span className="nature-option-title">
            <span className="nature-option-name">{name}</span>
            {name !== nature.name && <small className="nature-option-alias">{nature.name}</small>}
          </span>
          <span className="nature-option-effects">
            {modified ? <>
              <span className="nature-effect up">{t(`stat.${nature.upStat!}`)} <b>↑</b></span>
              <span className="nature-effect down">{t(`stat.${nature.downStat!}`)} <b>↓</b></span>
            </> : <span>{t("calc.natureNeutral")}</span>}
          </span>
        </span>,
      };
    };
    return [
      ...meta.map(({ item, share }) => ({ ...option(item), group: "meta" as const, badge: shareLabel(share) })),
      ...rest.sort(natureOrder).map((nature) => ({
        ...option(nature),
        section: nature.upStat && nature.downStat && nature.upStat !== nature.downStat
          ? `${t(`stat.${nature.upStat}`)} ↑` : t("calc.natureNeutral"),
      })),
    ];
  }, [natures, usage, lang, t]);
  const findExact = (raw: string) => {
    const query = raw.trim().toLowerCase();
    return natures.find((nature) => [
      nature.name, nature.nameZh, nature.nameJa, natureLabel(nature, lang),
    ].some((label) => label?.toLowerCase() === query));
  };
  const commit = (raw: string) => {
    resetText();
    const query = raw.trim().toLowerCase();
    if (!query) { onChange(""); return; }
    const hit = findExact(raw) ?? natures.find((nature) => [
      nature.name, nature.nameZh, nature.nameJa,
    ].some((label) => label?.toLowerCase().includes(query)));
    if (hit) {
      if (hit.name !== value) onChange(hit.name);
    }
  };
  return <AdaptiveCombobox value={text} options={options} placeholder="—"
    onValueChange={(next) => {
      setText(next);
      const hit = findExact(next);
      if (hit && hit.name !== value) onChange(hit.name);
      else if (!next.trim() && value) onChange("");
    }}
    onCommit={commit} />;
}
