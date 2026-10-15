import { MOVE_CATEGORIES, TYPE_NAMES } from "@pokemon-champions/protocol";
import { IconX } from "@tabler/icons-react";
import type { CSSProperties } from "react";
import { MEGA_ICON, MEGA_TINT, categoryColor, categoryIconUrl, typeColor, typeIconUrl } from "../../assets/icons.ts";
import { useLang } from "../../i18n.ts";
import { useSharedT } from "../messages.ts";
import { categoryLabel, categoryShortLabel, typeLabel, typeShortLabel } from "../TypeBadge.tsx";
import "./styles.typefilter.css";

const TYPES = TYPE_NAMES.filter((type) => type !== "Typeless");

interface ChipSpec {
  key: string;
  pressed: boolean;
  label: string;
  short: string;
  /** A colour or a gradient: the picked chip's background, which the icon's disc merges into. */
  tint: string;
  icon: string | undefined;
  onClick: () => void;
}

function Chip({ pressed, label, short, tint, icon, onClick }: ChipSpec) {
  return <button type="button" aria-pressed={pressed} aria-label={label} title={label}
    style={{ "--tc": tint } as CSSProperties} onClick={onClick}>
    <img src={icon} alt="" />
    <span className="type-filter-name" aria-hidden="true">{short}</span>
  </button>;
}

/** Type icons above a picker's list. Every icon keeps its colour and place, so a second pick is as
 * easy to find as the first; a pick becomes a solid chip of its own colour. How many picks a list
 * allows is the caller's rule (`toggleType`). A list may add a filter of its own in extra columns at
 * the right — a move list the three categories, a Pokémon list the Mega marker — and the clear button
 * then sits in the last of those cells and empties every condition. */
export function TypeFilter({ value, onToggle, categories, mega, onClear }: {
  value: readonly string[];
  onToggle: (type: string) => void;
  categories?: { value: readonly string[]; onToggle: (category: string) => void };
  mega?: { value: boolean; onToggle: () => void };
  onClear: () => void;
}) {
  const { lang } = useLang();
  const t = useSharedT();
  const side: ChipSpec[] = categories
    ? MOVE_CATEGORIES.map((category) => ({
      key: category, pressed: categories.value.includes(category), label: categoryLabel(category, lang),
      short: categoryShortLabel(category, lang), tint: categoryColor(category), icon: categoryIconUrl(category),
      onClick: () => categories.onToggle(category),
    }))
    : mega ? [{
      key: "mega", pressed: mega.value, label: t("picker.mega"), short: t("picker.megaShort"),
      tint: MEGA_TINT, icon: MEGA_ICON, onClick: mega.onToggle,
    }] : [];
  // Two rows: the extra chips plus the clear button fill side.length + 1 cells.
  const columns = Math.ceil((side.length + 1) / 2);
  const active = value.length > 0 || side.some((chip) => chip.pressed);
  const clearLabel = t(side.length ? "picker.clearFilters" : "picker.clearType");
  const clear = <button type="button" className="type-filter-clear" aria-label={clearLabel} title={clearLabel}
    disabled={!active} onClick={onClear}><IconX size={12} /></button>;
  return <div className={`type-filter${side.length ? ` side-${columns}` : ""}`}
    onPointerDown={(event) => event.preventDefault()}>
    <div className="type-filter-grid" role="group" aria-label={t("picker.typeFilter")}>
      {TYPES.map((type) => <Chip key={type} pressed={value.includes(type)} label={typeLabel(type, lang)}
        short={typeShortLabel(type, lang)} tint={typeColor(type)} icon={typeIconUrl(type)}
        onClick={() => onToggle(type)} />)}
    </div>
    {side.length ? <div className="type-filter-side" role="group"
      aria-label={categories ? t("picker.categoryFilter") : undefined}>
      {side.map((chip) => <Chip {...chip} key={chip.key} />)}
      {clear}
    </div> : clear}
  </div>;
}

/** The next selection after a press: a picked value is released; a new one is added until `limit`,
 * past which it replaces the latest pick, so a wrong or changed choice takes one press. */
export function toggleType(current: readonly string[], type: string, limit: number): string[] {
  if (current.includes(type)) return current.filter((picked) => picked !== type);
  return current.length < limit ? [...current, type] : [...current.slice(0, limit - 1), type];
}
