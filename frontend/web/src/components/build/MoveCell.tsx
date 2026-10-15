/** A move slot as the result grids show it: the move is typed in a short box, the rest of the cell is
 * what you press to select it, and the reading it produced sits on the right. The damage calculator
 * and the bulk tool use the same cell, so a move reads — and is edited — the same way on both tabs. */
import { MOVE_CATEGORIES, TYPE_NAMES, type LearnsetDto } from "@pokemon-champions/protocol";
import { memo, useMemo, useRef, useState, type ReactNode } from "react";
import { AdaptiveCombobox } from "../AdaptiveCombobox.tsx";
import { CategoryBadge, TypeBadge, typeLabel } from "../TypeBadge.tsx";
import { typeColor } from "../../assets/icons.ts";
import { displayName, useLang } from "../../i18n.ts";
import { useMovesByName } from "../../hooks.ts";
import { useLocalizedDraft } from "./useLocalizedDraft.ts";
import { useSharedT } from "../messages.ts";
import { shareLabel, splitByUsage, type MetaUsage } from "../../lib/metaUsage.ts";
import { OptionRow } from "../OptionRow.tsx";
import { TypeFilter, toggleType } from "./TypeFilter.tsx";
import "./styles.move.css";

type LearnMove = LearnsetDto["moves"][number];
const TYPE_ORDER = new Map<string, number>(TYPE_NAMES.map((type, at) => [type, at]));
const CATEGORY_ORDER = new Map<string, number>(MOVE_CATEGORIES.map((category, at) => [category, at]));

/** Below the metagame's own picks, a learnset reads by type, then category, then power. */
function moveOrder(a: LearnMove, b: LearnMove): number {
  return (TYPE_ORDER.get(a.type) ?? 99) - (TYPE_ORDER.get(b.type) ?? 99)
    || (CATEGORY_ORDER.get(a.category) ?? 9) - (CATEGORY_ORDER.get(b.category) ?? 9)
    || (b.power ?? -1) - (a.power ?? -1)
    || a.name.localeCompare(b.name);
}

/** A learnset-restricted move input: typing resolves against this mon's own legal moves in any of
 * the three languages, so a slot can never hold a move the calc would reject. */
export function MoveSlot({ value, onChange, learnset, index, usage }: {
  value: string;
  onChange: (name: string) => void;
  learnset: LearnsetDto | null;
  index: number;
  /** This Pokémon's metagame moves lead the list, most used first. */
  usage?: MetaUsage | null;
}) {
  const { lang } = useLang();
  const t = useSharedT();
  const vocab = useMovesByName();
  const moves = learnset?.moves ?? [];
  const current = moves.find((m) => m.name === value) ?? vocab.get(value);
  const label = current ? displayName(current, lang) : value;
  const [text, setText, resetText] = useLocalizedDraft(value, label, lang);
  const rootRef = useRef<HTMLSpanElement>(null);
  // Like the dex's move filter: any number of picks per row of icons, a move of ANY picked type and
  // ANY picked category is listed; the two filters narrow each other.
  const [types, setTypes] = useState<readonly string[]>([]);
  const [categories, setCategories] = useState<readonly string[]>([]);

  const options = useMemo(() => {
    const shown = moves.filter((m) => (!types.length || types.includes(m.type))
      && (!categories.length || categories.includes(m.category)));
    const { meta, rest } = splitByUsage(shown, (m) => m.name, usage?.moves);
    const option = (m: LearnMove, share: string | null) => ({
      key: m.name,
      value: displayName(m, lang),
      searchText: `${m.name} ${m.nameZh ?? ""} ${m.nameJa ?? ""} ${typeLabel(m.type, lang)}`,
      label: <OptionRow name={displayName(m, lang)} share={share} alias={lang === "en" ? null : m.name}>
        <span className="move-option-facts">
          <TypeBadge type={m.type} iconOnly />
          <CategoryBadge category={m.category} />
          <span className="move-option-power num">{m.power ?? ""}</span>
        </span>
      </OptionRow>,
    });
    const blank = meta.length ? "" : null;
    return [
      ...meta.map(({ item, share }) => ({ ...option(item, shareLabel(share)), group: "meta" as const })),
      ...[...rest].sort(moveOrder).map((m) => option(m, blank)),
    ];
  }, [moves, lang, usage, types, categories]);

  const resolve = (raw: string): string | null => {
    const q = raw.trim();
    if (!q) return "";
    const lower = q.toLowerCase();
    const exact = moves.find((m) => m.name.toLowerCase() === lower
      || m.nameZh === q || m.nameJa === q || displayName(m, lang).toLowerCase() === lower);
    if (exact) return exact.name;
    const part = moves.find((m) => m.name.toLowerCase().includes(lower)
      || (m.nameZh ?? "").includes(q) || (m.nameJa ?? "").includes(q));
    return part ? part.name : null;
  };

  return (
    <div className="move-slot">
      <span className="move-slot-mark">
        {current ? <TypeBadge type={current.type} iconOnly /> : <span className="move-slot-dot" />}
      </span>
      <span className="move-slot-input" ref={rootRef}>
      <AdaptiveCombobox value={text} options={options} title={text || undefined} popupMinWidth={360}
        placeholder={`${t("calc.move")} ${index + 1}`} emptyMessage={t("picker.noMove")}
        popupHeader={<TypeFilter value={types}
          onToggle={(type) => setTypes((current) => toggleType(current, type, Infinity))}
          categories={{ value: categories,
            onToggle: (category) => setCategories((current) => toggleType(current, category, Infinity)) }}
          onClear={() => {
            setTypes([]);
            setCategories([]);
            rootRef.current?.querySelector("input")?.focus({ preventScroll: true });
          }} />}
        onValueChange={(next) => {
          setText(next);
          const hit = resolve(next);
          if (hit !== null && hit !== value && (hit === "" || moves.some((m) => m.name === hit
            && displayName(m, lang) === next.trim()))) onChange(hit);
        }}
        onCommit={(raw) => {
          const hit = resolve(raw);
          if (hit !== null) { if (hit !== value) onChange(hit); }
          resetText();
        }} />
      </span>
    </div>
  );
}

/** The input half of a cell, memoised: its option list is the whole learnset, and the reading beside
 * it changes on every edit elsewhere on the page. */
const MoveInput = memo(function MoveInput({ index, value, learnset, usage, onChange }: {
  index: number;
  value: string;
  learnset: LearnsetDto | null;
  usage?: MetaUsage | null;
  onChange: (index: number, name: string) => void;
}) {
  return <MoveSlot index={index} value={value} learnset={learnset} usage={usage}
    onChange={(name) => onChange(index, name)} />;
});

export function MoveCell({ index, value, learnset, usage, selected, pending = false, onSelect, onChange,
  children }: {
  index: number;
  value: string;
  learnset: LearnsetDto | null;
  /** The mover's metagame moves, which lead the slot's list. */
  usage?: MetaUsage | null;
  selected: boolean;
  /** The reading belongs to an earlier input while the current one is being computed. */
  pending?: boolean;
  onSelect: (index: number) => void;
  onChange: (index: number, name: string) => void;
  /** The reading: damage band, KO label, "Status" … */
  children: ReactNode;
}) {
  const type = learnset?.moves.find((move) => move.name === value)?.type;
  return (
    // Selecting happens on press and on focus, so clicking into the name to retype it also makes it
    // the live move; the input stays the only interactive element inside.
    <div className={`move-cell${selected ? " on" : ""}${pending ? " pending" : ""}`}
      aria-current={selected ? "true" : undefined}
      // The type arrives as a colour VARIABLE, not a fill: several types are dark enough that text on
      // the flat colour is unreadable, so the cell spends it on an edge, a ring and a wash.
      style={type ? { ["--mv" as string]: typeColor(type) } : undefined}
      onMouseDown={() => onSelect(index)} onFocus={() => onSelect(index)}>
      <MoveInput index={index} value={value} learnset={learnset} usage={usage} onChange={onChange} />
      <span className="move-cell-read num">{children}</span>
    </div>
  );
}
