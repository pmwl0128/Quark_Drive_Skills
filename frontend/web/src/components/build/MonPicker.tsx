import { useEffect, useRef, useState } from "react";
import type { ComboboxCommitReason } from "../AdaptiveCombobox.tsx";
import { GameImage } from "../GameImage.tsx";
import { PLACEHOLDERS } from "../../assets/icons.ts";
import { displayName, useLang } from "../../i18n.ts";
import { useSharedT } from "../messages.ts";
import { useRuntime } from "../../runtime/context.tsx";
import type { DexIndexEntry } from "../../runtime/adapter.ts";
import { PokemonCombo } from "./PokemonCombo.tsx";

/** Trilingual mon input with suggestions + sprite. Typing is always literal; exact zh/ja/en names
 * and explicit option picks resolve locally, while fuzzy adapter resolution requires Enter.
 * Reused by the mon editors and the speed-ladder rows. The sprite always identifies the literal selected
 * entry; an activated held-stone form is disclosed by the adjacent MEGA badge. */
export function MonPicker({ slug, onSlug, dex, placeholder, ariaLabel }: {
  slug: string;
  onSlug: (slug: string) => void;
  dex: DexIndexEntry[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  const { lang } = useLang();
  const t = useSharedT();
  const { adapter } = useRuntime();
  const entry = dex.find((e) => e.slug === slug);
  const [text, setText] = useState("");
  const resolveToken = useRef(0);
  // Typing clears the slug on every keystroke that does not name an exact entry, so "slug is empty"
  // alone cannot mean "blank the box" — that would erase the word being typed. Only an OUTSIDE
  // clear (a blank roster slot, a reset) blanks it.
  const typing = useRef(false);

  useEffect(() => {
    if (entry) { typing.current = false; setText(displayName(entry, lang)); return; }
    if (!typing.current) setText("");
  }, [lang, slug]);

  const localEntry = (value: string) => {
    const q = value.trim();
    if (!q) return undefined;
    return dex.find((candidate) =>
      candidate.name.toLowerCase() === q.toLowerCase() ||
      candidate.nameZh === q ||
      candidate.nameJa === q ||
      candidate.slug === q.toLowerCase());
  };

  const edit = (value: string) => {
    ++resolveToken.current;
    typing.current = true;
    setText(value);
    const q = value.trim();
    if (!q) { onSlug(""); return; }
    const local = localEntry(value);
    // Re-resolving the CURRENT mon would re-fire onSlug with the same slug, which an editor treats as
    // a new species — resetting the build and wiping an auto-fill that won't re-apply. Skip it.
    if (local) { if (local.slug !== slug) onSlug(local.slug); return; }
    // Never keep calculating with the previous Pokémon while the visible text names no exact entry.
    onSlug("");
  };

  const commit = (value: string, reason: ComboboxCommitReason) => {
    typing.current = false;
    const q = value.trim();
    if (!q) { onSlug(""); return; }
    const local = localEntry(value);
    if (local) {
      setText(displayName(local, lang));
      if (local.slug !== slug) onSlug(local.slug);
      return;
    }
    // Blur is not a user request to accept the first fuzzy match. Enter is.
    if (reason === "blur") return;
    const token = ++resolveToken.current;
    adapter.resolve([q], "pokemon").then((entries) => {
      if (token !== resolveToken.current) return;
      const canonical = entries[0]?.ok ? entries[0].canonical : undefined;
      const hit = canonical ? dex.find((e) => e.name === canonical) : undefined;
      if (hit) {
        setText(displayName(hit, lang));
        if (hit.slug !== slug) onSlug(hit.slug);
      } else {
        onSlug("");
      }
    }).catch(() => {
      if (token === resolveToken.current) onSlug("");
    });
  };

  return (
    <span className="mon-picker">
      <span className="mon-picker-slot">
        {entry
          ? <GameImage assetKey={entry.key} role="card" alt={entry.name}
              className="mini mon-picker-img" />
          : <img className="mini mon-picker-img" src={PLACEHOLDERS.pokemon}
              alt="" loading="lazy" aria-hidden />}
      </span>
      <PokemonCombo value={text} dex={dex}
        onValueChange={edit} onCommit={commit}
        aria-label={ariaLabel}
        placeholder={placeholder ?? t("calc.pickHint")} />
    </span>
  );
}
