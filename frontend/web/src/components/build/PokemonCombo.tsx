import { useMemo, useRef, useState, type ComponentProps } from "react";
import { AdaptiveCombobox } from "../AdaptiveCombobox.tsx";
import { TypeBadge } from "../TypeBadge.tsx";
import { displayName, useLang } from "../../i18n.ts";
import { useSharedT } from "../messages.ts";
import type { DexIndexEntry } from "../../runtime/adapter.ts";
import { TypeFilter, toggleType } from "./TypeFilter.tsx";
import "./styles.pokemon.css";

interface Props extends Omit<ComponentProps<typeof AdaptiveCombobox>,
  "options" | "popupHeader" | "popupMinWidth" | "emptyMessage"> {
  dex: readonly DexIndexEntry[];
}

/** One local, stable-order Pokémon list for every free-text species field. */
export function PokemonCombo({ dex, ...props }: Props) {
  const { lang } = useLang();
  const t = useSharedT();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [types, setTypes] = useState<readonly string[]>([]);
  // Mega forms only, combined with the types (a Mega form's own types).
  const [mega, setMega] = useState(false);
  const allOptions = useMemo(() => dex.map((entry) => ({
    key: entry.key, value: displayName(entry, lang),
    searchText: `${entry.name} ${entry.nameZh ?? ""} ${entry.nameJa ?? ""} ${entry.slug}`,
    types: entry.types,
    isMega: entry.isMega,
    label: <span className="pokemon-option">
      <span className="pokemon-option-title">
        <span>{displayName(entry, lang)}</span>
        {lang !== "en" && <small>{entry.name}</small>}
      </span>
      <span className="pokemon-option-types">
        {entry.types.map((type) => <TypeBadge key={type} type={type} iconOnly />)}
      </span>
    </span>,
  })), [dex, lang]);
  // Never reorder on ranking updates. A filter only removes nonmatching entries.
  const options = useMemo(() => types.length || mega
    ? allOptions.filter((option) => (!mega || option.isMega) && types.every((type) => option.types.includes(type)))
    : allOptions, [allOptions, types, mega]);
  const focusInput = () => rootRef.current?.querySelector("input")?.focus({ preventScroll: true });

  return <span className="pokemon-combo" ref={rootRef}>
    <AdaptiveCombobox {...props} options={options} popupMinWidth={280}
      emptyMessage={t("picker.noPokemon")}
      // No Pokémon has three types, so a third pick replaces the latest one.
      popupHeader={<TypeFilter value={types}
        onToggle={(type) => setTypes((current) => toggleType(current, type, 2))}
        mega={{ value: mega, onToggle: () => setMega((on) => !on) }}
        onClear={() => { setTypes([]); setMega(false); focusInput(); }} />} />
  </span>;
}
