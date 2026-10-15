/** Shared building blocks for the calc page's tools (damage, bulk tune, set inference, speed line)
 * and the build editors elsewhere: searchable pickers and observed-build-first auto-fill.
 * Worker-safe configuration values and transformations live in lib/buildState.ts. */
import type {
  FormatId, MetaDetailDto, OppSetCatalogDto, OppSetDto,
} from "@pokemon-champions/protocol";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BuildPicker, type BuildPickerSection } from "../BuildPicker.tsx";
import { AdaptiveCombobox } from "../AdaptiveCombobox.tsx";
import { OptionRow } from "../OptionRow.tsx";
import { loadOppSetsCached, useDexIndex, useItems } from "../../hooks.ts";
import { displayName, useLang, type MsgKey } from "../../i18n.ts";
import { useSharedT } from "../messages.ts";
import { useRuntime } from "../../runtime/context.tsx";
import { HttpError } from "../../runtime/adapter.ts";
import type { ItemRef } from "../../runtime/projection.ts";
import { shareLabel, splitByUsage, type MetaUsage } from "../../lib/metaUsage.ts";
import { itemOrder } from "../../lib/buildLabels.ts";
import { ItemLock } from "./FieldLabels.tsx";
import { useLocalizedDraft } from "./useLocalizedDraft.ts";
import { modalForEntry, observedBuildOptions, toModalSet, type BuildOption, type ModalSet } from "../../lib/buildState.ts";

/** Cached Meta fallback loader. A 404 (unranked this period) resolves to null; observed builds can
 * still be offered independently by `useBuildOptions`.
 *
 * Mega forms are never ranked on their own: the meta folds their usage into the BASE species, so
 * the base's panels already ARE the Mega build (measured: `charizard`'s top item is Charizardite Y).
 * A Mega pick therefore retries once against its base species instead of dead-ending on an empty
 * form. The item is deliberately NOT taken from those panels — a base shared by two stones ranks
 * only one of them (Charizard X would inherit Charizardite Y) — it is pinned to THIS form's own
 * required stone. The mon editors pin the same stone, but only on a slug change, so an auto-fill landing
 * afterwards must not reintroduce the wrong item. */
function useMetaFill(): (slug: string, fmt: FormatId) => Promise<ModalSet | null> {
  const { adapter } = useRuntime();
  const dexIndex = useDexIndex();
  const itemVocab = useItems();
  const cache = useRef(new Map<string, Promise<ModalSet | null>>());
  return (slug: string, fmt: FormatId) => {
    const key = `${fmt}:${slug}`;
    let hit = cache.current.get(key);
    if (!hit) {
      const dex = dexIndex.status === "ready" ? dexIndex.data : null;
      const items = itemVocab.status === "ready" ? itemVocab.data : null;
      const entry = dex?.find((e) => e.slug === slug);
      const base = entry?.isMega && entry.baseSpecies
        ? dex?.find((e) => e.name === entry.baseSpecies) : undefined;
      const stone = entry?.isMega && items
        ? items.find((i) => i.requiredBy?.includes(entry.name)) : undefined;
      // A 404 is only a DEFINITIVE "no build" once we could rule a base fallback in or out. With the
      // dex vocab still loading we cannot, so that null must not be cached as the answer.
      const definitive = dex !== null && (!entry || !entry.isMega || !!base);
      hit = (async () => {
        try {
          // A known Mega form has no independent ranking row. Go straight to its base detail:
          // probing the guaranteed-missing Mega URL first adds latency and a noisy browser 404.
          const dto: MetaDetailDto = await adapter.detail(fmt, base?.slug ?? slug);
          return modalForEntry(toModalSet(dto), entry, stone);
        } catch (e) {
          // 404 = unranked this period → no standard build; leave the form empty (cache it so we
          // don't re-hit a known-absent detail every pick).
          if (e instanceof HttpError && e.status === 404) {
            if (!definitive) cache.current.delete(key);
            return null;
          }
          // Any other failure (network, malformed projection, parse) is transient/real, not a "no build":
          // surface it, DROP the cache entry so a later re-pick retries (mirrors AsyncOnce's reject-drop —
          // a flaky load must not poison the slot for the whole session), and degrade to an empty form now.
          console.error(`meta detail auto-fill failed for ${fmt}/${slug}:`, e);
          cache.current.delete(key);
          return null;
        }
      })();
      cache.current.set(key, hit);
    }
    return hit;
  };
}

/** Cached build-choice loader shared by manual pickers and automatic fills. It reads the small set
 * catalog, never the multi-megabyte matchup matrix. Meta remains the final card even when observed
 * builds exist, and becomes the sole card for a species absent from the catalog. */
export function useBuildOptions(): (
  slug: string, fmt: FormatId,
) => Promise<BuildOption[]> {
  const { adapter, capabilities } = useRuntime();
  const dexIndex = useDexIndex();
  const itemVocab = useItems();
  const loadMeta = useMetaFill();
  const catalogCache = useRef(new Map<FormatId, Promise<OppSetCatalogDto | null>>());

  return async (slug: string, fmt: FormatId) => {
    let catalogHit = catalogCache.current.get(fmt);
    if (!catalogHit) {
      catalogHit = loadOppSetsCached(adapter, capabilities.deploymentId, fmt).catch((error) => {
        console.error(`observed build catalog failed for ${fmt}:`, error);
        catalogCache.current.delete(fmt);
        return null;
      });
      catalogCache.current.set(fmt, catalogHit);
    }
    const [catalog, meta] = await Promise.all([catalogHit, loadMeta(slug, fmt)]);
    const dex = dexIndex.status === "ready" ? dexIndex.data : [];
    const items = itemVocab.status === "ready" ? itemVocab.data : [];
    const observed = observedBuildOptions(catalog, slug, dex, items);
    if (!meta) return observed;
    const entry = dex.find((e) => e.slug === slug);
    const fallback: OppSetDto = {
      species: entry?.baseSpecies ?? entry?.name ?? slug,
      runForm: entry?.isMega ? entry.name : null,
      ability: meta.ability || null,
      item: meta.item || null,
      nature: meta.nature || null,
      moves: meta.moves,
      sps: meta.sps,
      isModal: false,
      coverage: null,
    };
    return [...observed, {
      key: `meta:${fmt}:${slug}`,
      source: "meta" as const,
      coverage: null,
      isModal: observed.length === 0,
      modal: meta,
      set: fallback,
    }];
  };
}

/** The environment-build control a mon card wears: one button that loads THIS species'
 * configurations on demand (observed builds first, Meta stitch last) and hands the picked card
 * back. Every card surface — damage editor, speed row, simulation member — opens the same popover,
 * so the loading, the discard-on-species-change and the anchoring live here instead of being
 * re-derived beside each card.
 *
 * `onOptions` exists for a caller that has to reconcile its own fields against the loaded cards
 * (the damage editor proves a hand-typed build IS an environment card that way); it must be a
 * stable reference, a `useState` setter being the intended shape. */
export function BuildPickerButton({
  slug, format, formats, currentKey, onPick, onOptions, disabled = false,
  className = "ghost-btn tiny", label,
}: {
  slug: string;
  format: FormatId;
  /** Offer several formats' builds at once, one section each (a box Pokémon belongs to no format). */
  formats?: FormatId[];
  currentKey?: string;
  onPick: (option: BuildOption, index: number) => void;
  onOptions?: (options: BuildOption[]) => void;
  disabled?: boolean;
  className?: string;
  label?: ReactNode;
}) {
  const t = useSharedT();
  const loadBuildOptions = useBuildOptions();
  const anchor = useRef<HTMLButtonElement>(null);
  const requestSeq = useRef(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<BuildOption[]>([]);
  const [sections, setSections] = useState<Array<BuildPickerSection & { options: BuildOption[] }> | null>(null);
  const multi = formats && formats.length > 1 ? formats : null;
  const formatKey = multi ? multi.join("+") : format;

  // A species or format change invalidates both the request in flight and the cards already on
  // screen: they describe an environment this card is no longer in.
  useEffect(() => {
    requestSeq.current += 1;
    setOpen(false);
    setBusy(false);
    setOptions([]);
    setSections(null);
    onOptions?.([]);
  }, [slug, formatKey, onOptions]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setBusy(true);
    const seq = ++requestSeq.current;
    const load = multi
      ? Promise.all(multi.map((id) => loadBuildOptions(slug, id))).then((groups) => {
        if (requestSeq.current !== seq) return;
        setSections(multi.map((id, at) => ({ key: id, label: t(`format.${id}` as MsgKey), options: groups[at] ?? [] })));
        setOptions(groups.flat());
      })
      : loadBuildOptions(slug, format).then((next) => {
        if (requestSeq.current !== seq) return;
        setOptions(next);
        onOptions?.(next);
      });
    void load.finally(() => {
      if (requestSeq.current === seq) setBusy(false);
    });
  };

  return (
    <>
      <button ref={anchor} type="button" className={`${className} build-picker-trigger`} onClick={toggle}
        disabled={disabled || !slug} aria-expanded={open}
        title={t("calc.metaSetHint")}>{label ?? t("calc.metaSet")}</button>
      {open && (
        <BuildPicker options={options} sections={sections ?? undefined} currentKey={currentKey}
          anchorRef={anchor} busy={busy} hint={t("calc.setPickHint")}
          onPick={(picked) => {
            // Within its own list: a section's cards are numbered from A again.
            const list = sections?.find((section) => section.options.includes(picked as BuildOption))?.options ?? options;
            const index = list.findIndex((candidate) => candidate === picked || candidate.key === picked.key);
            const option = list[index];
            if (option) onPick(option, index);
          }}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/** Typeable trilingual item input, mirroring MonPicker: free text in any of the
 * three languages resolves to the English canonical; empty clears. */
export function ItemCombo({ value, onChange, items, disabled, usage }: {
  value: string;
  onChange: (canonical: string) => void;
  items: ItemRef[];
  /** A Mega FORM picked by name locks its stone — the input goes read-only. */
  disabled?: boolean;
  /** This Pokémon's metagame items lead the list, most used first. */
  usage?: MetaUsage | null;
}) {
  const { lang } = useLang();
  const current = items.find((item) => item.name === value);
  const [text, setText, resetText] = useLocalizedDraft(value, current ? displayName(current, lang) : value, lang);
  const options = useMemo(() => {
    const { meta, rest } = splitByUsage([...items].sort(itemOrder), (i) => i.name, usage?.items);
    const option = (i: ItemRef, share: string | null) => ({
      key: i.key, value: displayName(i, lang), searchText: `${i.name} ${i.nameZh ?? ""} ${i.nameJa ?? ""}`,
      label: <OptionRow name={displayName(i, lang)} share={share} alias={lang === "en" ? null : i.name} />,
    });
    const blank = meta.length ? "" : null;
    return [
      ...meta.map(({ item: i, share }) => ({ ...option(i, shareLabel(share)), group: "meta" as const })),
      ...rest.map((i) => option(i, blank)),
    ];
  }, [items, lang, usage]);
  const resolve = (q: string): string | null => {
    const needle = q.trim().toLowerCase();
    if (!needle) return "";
    const exact = items.find((i) =>
      i.name.toLowerCase() === needle || i.nameZh === q.trim() || i.nameJa === q.trim()
      || displayName(i, lang).toLowerCase() === needle);
    if (exact) return exact.name;
    const part = items.find((i) =>
      i.name.toLowerCase().includes(needle) || (i.nameZh ?? "").includes(q.trim())
      || (i.nameJa ?? "").includes(q.trim()));
    return part ? part.name : null;
  };
  const commit = (raw: string) => {
    const hit = resolve(raw);
    if (hit !== null) { if (hit !== value) onChange(hit); }
    resetText();
  };
  return (
    <ItemLock locked={disabled}>
      <AdaptiveCombobox value={text} disabled={disabled} options={options} popupMinWidth={320}
        onValueChange={(next) => {
          setText(next);
          const q = next.trim();
          const exact = items.find((i) =>
            displayName(i, lang) === q || i.name === q || i.nameZh === q || i.nameJa === q);
          if (exact) { if (exact.name !== value) onChange(exact.name); }
          else if (!q && value !== "") onChange("");
        }}
        onCommit={commit} />
    </ItemLock>
  );
}
