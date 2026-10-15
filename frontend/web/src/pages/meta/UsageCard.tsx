/** The usage card: everything on the ranking/details clock for one Pokemon in one format, sized so
 * the whole card fits a 1920×1080 first screen and can be captured as one picture.
 *
 * The page's top bar already names the snapshot, so the card itself carries only the site mark and
 * the share action (at the foot of the ability column); the share image prints the snapshot in its
 * frame. The KO axis runs on a different snapshot clock and is a separate card with its own stamp
 * (frontend/design.md §7.1.1).
 *
 * Colour: the Pokemon's own types are the only hue. The primary type fills the share bars, the
 * leader values and the SP heat cells; both types stripe the top edge. */
import type {
  FormatId, MetaDetailDto, MoveCategory, PokemonCardDto, TopMetaDetailDto, TypeName,
  UsageTrendDto,
} from "@pokemon-champions/protocol";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { BRAND_LOGO, PUBLIC_SITE_HOST, typeColor } from "../../assets/icons.ts";
import { GameImage } from "../../components/GameImage.tsx";
import { CategoryBadge, TypeBadge } from "../../components/TypeBadge.tsx";
import { useNatures, type Async } from "../../hooks.ts";
import { displayName, useLang } from "../../i18n.ts";
import { useMetaT } from "./messages.ts";
import type { RealSet } from "../../lib/realSets.ts";
import { usageDelta } from "../../lib/usageDelta.ts";
import { MetaHero, type MetaForm } from "./MetaHero.tsx";
import { MonTile } from "./MonTile.tsx";
import { PanelHead, partnerRanks, TrendAddon, UsageRow, usageSeries } from "./rows.tsx";
import { SetStrip } from "./SetStrip.tsx";
import { SpMatrix, type SpRow } from "./SpMatrix.tsx";
import { RankDeltaChip } from "../../components/MetaRank.tsx";
import { fromView, type MetaView } from "../../lib/metaView.ts";
import {
  CompareAddon, CompareCell, makeLens, type CompareLens, type PartnerRecord, type ValuePanel,
} from "./compare.tsx";

const SPREAD_ROWS = 10;

export function accentStyle(mon: PokemonCardDto): CSSProperties {
  const [first, second] = mon.types;
  return {
    "--acc": typeColor(first ?? "Typeless"),
    "--acc2": typeColor(second ?? first ?? "Typeless"),
  } as CSSProperties;
}

/** "2026-09-11" -> "09-11": the window never spans a year boundary worth printing. */
export const shortDate = (period: string) => period.length >= 10 ? period.slice(5) : period;

export interface UsageCardProps {
  /** The form the hero shows (the base species or one of its Megas). */
  mon: PokemonCardDto;
  forms?: MetaForm[];
  format: FormatId;
  ranks: Array<[FormatId, number | null]>;
  onFormat?: (format: FormatId) => void;
  /** Usage panels, always keyed by the base species. */
  detail: Async<MetaDetailDto>;
  trend: Async<UsageTrendDto | null>;
  /** English canonical -> this format's usage rank, for the teammate tiles. */
  usageRank: Map<string, number>;
  sets: RealSet[];
  setIndex: number;
  onSetIndex?: (index: number) => void;
  /** The share image's source and scope, printed at the right of the brand line. Also enables the
   * public website mark below the partner grid in both local and online runtimes. */
  shareSource?: string;
  onShare?: () => void;
  /** A hover or focus on the share button: time to fetch the share dialog. */
  onShareIntent?: () => void;
  /** Interactive page controls, omitted from the share image. */
  controls?: ReactNode;
  /** Which metagame the card shows and whether it compares (lib/metaView.ts); in-game when absent. */
  view?: MetaView;
  /** Top Meta panels (both scopes): the Top Meta card's rows, or the in-game card's comparison. */
  top?: Async<TopMetaDetailDto | null>;
  /** Extra link query so teammate tiles open the same metagame view. */
  linkQuery?: string;
}

/** One panel row, whichever metagame it comes from. */
interface PanelRow<E> {
  rank: number;
  entry: E;
  pct: number | null;
  /** Top Meta below five samples prints the raw count instead of a share. */
  count?: string;
}

export function UsageCard(props: UsageCardProps) {
  const { mon, forms, format, ranks, onFormat, detail, trend, usageRank, sets, setIndex,
    onSetIndex, shareSource, onShare, onShareIntent, controls, view, top, linkQuery = "" } = props;
  const { lang } = useLang();
  const t = useMetaT();
  const natureList = useNatures();
  const natures = useMemo(() => new Map(natureList.status === "ready"
    ? natureList.data.map((n) => [n.name, n] as const) : []), [natureList]);
  const isTop = view?.source === "top";
  const topDoc = top?.status === "ready" ? top.data : null;
  const topScope = topDoc ? topDoc.scopes[isTop && view ? view.scope : "season"] : null;
  // One lens serves both views: the Top Meta card compares against in-game, the in-game card
  // against Top Meta. The regulation scope uses the current in-game snapshot.
  const lens: CompareLens | null = useMemo(
    () => view?.compare && topScope && topScope.comparedWith ? makeLens(view.source, topScope) : null,
    [view?.compare, view?.source, topScope]);
  // The Top Meta hover line reads its own records even while the comparison column is off.
  const hoverLens = useMemo(() => lens ?? (isTop && topScope ? makeLens("top", topScope) : null),
    [lens, isTop, topScope]);
  const ready = detail.status === "ready" ? detail.data : null;

  function panelRows<E>(panel: ValuePanel): PanelRow<E>[] {
    if (isTop) {
      if (!topScope) return [];
      const { tier, n, entries } = topScope.panels[panel];
      return (entries as Array<{ count: number; share: number | null }>)
        .filter((e) => e.count > 0).slice(0, panel === "spreads" ? SPREAD_ROWS : 10)
        .map((e, i) => ({ rank: i + 1, entry: e as unknown as E, pct: e.share,
                          count: tier === "count" ? `${e.count}/${n}` : undefined }));
    }
    if (!ready) return [];
    // Every other panel arrives as its top ten; the spreads source sends thirty, and the card shows ten.
    const list = panel === "spreads" ? ready.panels.spreads.slice(0, SPREAD_ROWS) : ready.panels[panel];
    return (list as Array<{ rank: number; percentage: number | null }>).map((e) => ({
      rank: e.rank, entry: e as unknown as E, pct: e.percentage }));
  }
  const bodyState = isTop
    ? top?.status === "loading" ? t("state.loading")
      : top?.status === "error" && top.httpStatus !== 404 ? t("state.errorDetail")
      : !topScope ? t("mc.topNone") : null
    : detail.status === "loading" ? t("state.loading")
    // A 404 is the factual "not ranked this period"; anything else is a real load failure and must
    // not masquerade as a metagame fact.
    : detail.status === "error"
      ? detail.httpStatus === 404 ? t("detail.notRanked") : t("state.errorDetail")
      : null;
  const periods = trend.status === "ready" && trend.data ? trend.data.periods : [];
  const baseline = periods.length > 1 ? shortDate(periods[0]!) : undefined;
  const pctNote = (panel: ValuePanel) => {
    if (isTop && topScope) {
      // The sample is named in words — "597 builds", "25 with SP" — instead of a bare n.
      const { tier, n } = topScope.panels[panel];
      const sample = t(panel === "spreads" ? "mc.topSampleSp" : "mc.topSample").replace("{n}", String(n));
      if (tier === "count") return t("mc.topFew").replace("{sample}", sample);
      if (!lens) return sample;
      return `${sample} · ${t(topScope.comparedWith?.window === "current_snapshot"
        ? "mc.vsCurrentOfficial" : "mc.vsOfficial")}`;
    }
    if (lens) return t("mc.pctVsTop");
    return baseline ? t("mc.pctVs").replace("{date}", baseline) : t("mc.pct");
  };
  const natureMod = (name: string) => {
    const n = natures.get(name);
    return n?.upStat && n.downStat
      ? <span className="mc-sub">+{t(`stat.${n.upStat}`)} −{t(`stat.${n.downStat}`)}</span> : null;
  };
  /** The right-hand cell and the hover line of one value row. */
  const rowParts = (panel: Exclude<ValuePanel, "spreads">, name: string) => {
    if (isTop) {
      return {
        delta: undefined,
        cell: lens ? <CompareCell lens={lens} panel={panel} entry={{ name }} /> : undefined,
        addon: hoverLens ? <CompareAddon lens={hoverLens} panel={panel} entry={{ name }} /> : null,
      };
    }
    const values = usageSeries(trend, panel, name);
    return {
      delta: lens ? undefined : usageDelta(values),
      cell: lens ? <CompareCell lens={lens} panel={panel} entry={{ name }} /> : undefined,
      addon: <TrendAddon trend={trend} values={values} kind="pct" />,
    };
  };
  const shownRank = isTop ? topScope?.rank ?? null : ready?.rank ?? null;

  const abilityRows = (ready || topScope) && (
    <div className="mc-abilities">
      <PanelHead title={t("detail.abilities")} note={pctNote("abilities")} />
      {panelRows<NamedLike>("abilities").map((r, i) => {
        const parts = rowParts("abilities", r.entry.name);
        return (
          <UsageRow key={`${r.rank}-${r.entry.name}`} rank={r.rank} lead={i === 0} pct={r.pct}
                    pctLabel={r.count} delta={parts.delta} cell={parts.cell} baseline={baseline}
                    hover={{ kind: "ability", name: r.entry.name, addon: parts.addon }}>
            {displayName(r.entry, lang)}
          </UsageRow>
        );
      })}
    </div>
  );

  // Top Meta shows its first ten teammates, like the official panel; rows kept only for the official
  // page's comparison (outside the Top Meta top ten) stay off this card.
  const partners: PartnerLike[] = isTop
    ? (topScope?.panels.partners.entries ?? []).filter((p) => p.count > 0 && p.rank != null)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).slice(0, 10)
    : ready?.panels.partners ?? [];

  return (
    <section className={`mc-card mc-usage${isTop ? " mc-top" : ""}${lens ? " mc-compare" : ""}`}
             style={accentStyle(mon)}
             aria-label={`${displayName(mon, lang)} · ${t(`format.${format}`)}`}>
      <div className="mc-strip" aria-hidden="true" />
      {controls && <div className="mc-viewbar">{controls}</div>}
      <MetaHero mon={mon} forms={forms} rank={shownRank} ranks={ranks} format={format}
                onFormat={onFormat} abilities={abilityRows}
                sideFoot={
                  <span className="mc-brand">
                      <img src={BRAND_LOGO} alt="" />
                      <span>Quark Drive</span>
                      {shareSource && <span className="mc-brand-source">{shareSource}</span>}
                      {onShare && (
                        <button type="button" className="mc-share-btn" onClick={onShare}
                                onPointerEnter={onShareIntent} onFocus={onShareIntent}>
                          <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.5v7.5M3.8 6 7 9.2 10.2 6M2 11.5h10" /></svg>
                          {t("mc.share")}
                        </button>
                      )}
                    </span>
                } />
      {sets.length > 0 && <SetStrip sets={sets} index={setIndex} onIndex={onSetIndex} />}
      {bodyState == null ? (
        <div className="mc-grid">
          <div className="mc-panel mc-moves">
            <PanelHead title={t("detail.moves")} note={pctNote("moves")} />
            {panelRows<MoveLike>("moves").map((r, i) => {
              const parts = rowParts("moves", r.entry.name);
              return (
                <UsageRow key={`${r.rank}-${r.entry.name}`} rank={r.rank} lead={i === 0} pct={r.pct}
                          pctLabel={r.count} delta={parts.delta} cell={parts.cell} baseline={baseline}
                          sub={r.entry.power != null ? <span className="mc-power">{r.entry.power}</span> : null}
                          hover={{ kind: "move", name: r.entry.name, addon: parts.addon }}>
                  {r.entry.type && <TypeBadge type={r.entry.type} iconOnly />}
                  {r.entry.category && <CategoryBadge category={r.entry.category} />}
                  <span className="mc-text">{displayName(r.entry, lang)}</span>
                </UsageRow>
              );
            })}
          </div>
          <div className="mc-panel mc-items">
            <PanelHead title={t("detail.items")} note={pctNote("items")} />
            {panelRows<ItemLike>("items").map((r, i) => {
              const parts = rowParts("items", r.entry.name);
              return (
                <UsageRow key={`${r.rank}-${r.entry.name}`} rank={r.rank} lead={i === 0} pct={r.pct}
                          pctLabel={r.count} delta={parts.delta} cell={parts.cell} baseline={baseline}
                          hover={{ kind: "item", name: r.entry.name, addon: parts.addon }}>
                  <GameImage assetKey={r.entry.key} role="dense" alt="" className="mc-item-img" />
                  <span className="mc-text">{displayName(r.entry, lang)}</span>
                </UsageRow>
              );
            })}
          </div>
          <div className="mc-panel mc-natures">
            <PanelHead title={t("detail.natures")} note={pctNote("natures")} />
            {panelRows<NamedLike>("natures").map((r, i) => {
              const parts = rowParts("natures", r.entry.name);
              return (
                <UsageRow key={`${r.rank}-${r.entry.name}`} rank={r.rank} lead={i === 0} pct={r.pct}
                          pctLabel={r.count} delta={parts.delta} cell={parts.cell} baseline={baseline}
                          sub={natureMod(r.entry.name)}
                          hover={{ kind: "nature", name: r.entry.name, addon: parts.addon }}>
                  <span className="mc-text">{displayName(r.entry, lang)}</span>
                </UsageRow>
              );
            })}
          </div>
          <div className="mc-panel mc-spreads">
            <SpreadsPanel rows={panelRows<{ spread: SpRow["spread"] }>("spreads")} trend={trend}
                          baseline={baseline} lens={lens} isTop={isTop} hoverLens={hoverLens}
                          note={pctNote("spreads")} />
          </div>
          <div className={`mc-panel mc-partners${shareSource ? " mc-share-partners" : ""}`}>
            <PanelHead title={t("detail.partners")}
                       note={isTop ? t("mc.topPartnersNote") : t("mc.partnersNote")} />
            <div className="mc-tiles">
              {partners.map((p) => {
                const record = lens
                  ? lens.partner(p.name, isTop ? undefined : p.rank ?? undefined) : undefined;
                return (
                  <MonTile key={`${p.rank}-${p.name}`} format={format} linkQuery={linkQuery}
                           entry={{ ...p, rank: p.rank ?? 0, usageRank: usageRank.get(p.name) ?? null }}
                           useTitle={isTop ? t("mc.topRank") : undefined}
                           mark={lens ? <PartnerMark lens={lens} record={record} /> : undefined}
                           addon={isTop ? null : <TrendAddon trend={trend}
                             values={partnerRanks(trend, p.nationalDex)} kind="rank" />} />
                );
              })}
            </div>
            {shareSource && <span className="mc-share-host">{PUBLIC_SITE_HOST}</span>}
          </div>
        </div>
      ) : (
        <div className="mc-body-state">{bodyState}</div>
      )}
    </section>
  );
}

type NamedLike = { name: string; nameZh?: string; nameJa?: string };
type MoveLike = NamedLike & { type: TypeName | null; category: MoveCategory | null; power: number | null };
type ItemLike = NamedLike & { key: string };
type PartnerLike = NamedLike & { rank: number | null; slug?: string; key?: string; nationalDex?: number };

/** The teammate chip: rank against rank, read from this view (teammates publish only an order). */
function PartnerMark({ lens, record }: { lens: CompareLens; record: PartnerRecord | undefined }) {
  const t = useMetaT();
  if (!record) {
    return <RankDeltaChip delta={null} title={t("cmp.partnerAbsentTop")} />;
  }
  const ingame = record.ingame;
  const title = lens.source === "top"
    ? ingame?.kind === "rank" ? t("cmp.partnerIngame").replace("{r}", String(ingame.value))
      : t("cmp.partnerUnlisted")
    : record.count > 0 && record.rank != null
      ? t("cmp.partnerTop").replace("{r}", String(record.rank)) : t("cmp.partnerAbsentTop");
  const value = record.count > 0 && ingame?.kind === "rank" ? fromView(record.rankDelta, lens.source) : null;
  return <RankDeltaChip delta={value} title={title} />;
}

function SpreadsPanel({ rows, trend, baseline, lens, isTop, hoverLens, note }: {
  rows: PanelRow<{ spread: SpRow["spread"] }>[];
  trend: Async<UsageTrendDto | null>;
  baseline?: string;
  lens: CompareLens | null;
  isTop: boolean;
  hoverLens: CompareLens | null;
  note: string;
}) {
  const t = useMetaT();
  const spreads: SpRow[] = rows.map((r) => ({ rank: r.rank, spread: r.entry.spread, percentage: r.pct }));
  const counts = new Map(rows.map((r) => [r.rank, r.count]));
  const sum = spreads.reduce((total, s) => total + (s.percentage ?? 0), 0);
  // Same rule as the other panels: the comparison column exists only while comparing.
  const compareView = isTop || lens ? {
    head: t("mc.compare"),
    cell: lens ? (s: SpRow) => <CompareCell lens={lens} panel="spreads" entry={{ spread: s.spread }} />
      : undefined,
    pctLabel: isTop ? (s: SpRow) => counts.get(s.rank) : undefined,
    addon: isTop && hoverLens
      ? (s: SpRow) => <CompareAddon lens={hoverLens} panel="spreads" entry={{ spread: s.spread }} />
      : undefined,
  } : undefined;
  return (
    <>
      <PanelHead title={t("detail.spreads")} note={isTop || lens ? note
        : t("mc.spNote").replace("{n}", String(spreads.length)).replace("{sum}", sum.toFixed(1))} />
      <SpMatrix spreads={spreads} trend={trend} baseline={baseline} view={compareView} />
    </>
  );
}
