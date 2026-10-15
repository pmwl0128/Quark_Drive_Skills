import type { FormatId, RankRowDto } from "@pokemon-champions/protocol";
import { lazy, Suspense, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FormatTabs } from "../components/FormatTabs.tsx";
import { GameImage } from "../components/GameImage.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { MoreRows, useProgressiveRows } from "../components/ProgressiveRows.tsx";
import { MetaRail, useMetaRails } from "../components/MetaRails.tsx";
import { RailHandle, useRailEscape } from "../components/SideRail.tsx";
import { useRanking, useTopRanking } from "../hooks.ts";
import { displayName, useLang, useT } from "../i18n.ts";
import { TypeBadge } from "../components/TypeBadge.tsx";
import {
  CompareToggle, MetaNotes, ScopeSwitch, SourceSwitch,
} from "../components/MetaSourceBar.tsx";
import { RankBadge, RankDeltaChip, ShareTag } from "../components/MetaRank.tsx";
import { useTopT } from "../components/metaMessages.ts";
import { fromView, metaViewQuery, readMetaView } from "../lib/metaView.ts";

// The trend view (its data and its chart) loads only when the reader switches to it.
const TrendView = lazy(() => import("../components/TrendView.tsx").then((m) => ({ default: m.TrendView })));

type RankingView = "list" | "trend";
const EMPTY_RANKING: never[] = [];

/** One grid card's data, whichever metagame the grid shows. */
interface CardRow {
  rank: number;
  slug: string;
  key?: string;
  name: string;
  nameZh?: string;
  nameJa?: string;
  types?: RankRowDto["types"];
  /** Top Meta only: presence share, or the team count under the count tier. */
  share?: string;
  /** The comparison chip, already read from this view's perspective; undefined = no chip. */
  delta?: { value: number | null; minor: boolean; title: string };
}

/** Grid cards (same density as the dex browser): rank badge + sprite + trilingual name +
 * type icons — a full top-50 fits on one screen. The header row carries the source switch
 * (official data | Top Meta); beside it sits what belongs to that source — the official rank trend
 * (`?view=trend`; the old `?trend=1` still opens it) or the Top Meta scope — and at its right end
 * the comparison toggle with the one explanatory note. */
export function RankingPage() {
  const [params, setParams] = useSearchParams();
  const format = (params.get("format") === "double" ? "double" : "single") as FormatId;
  const view: RankingView = params.get("view") === "trend" || params.get("trend") === "1" ? "trend" : "list";
  const setFormat = (next: FormatId) => {
    const updated = new URLSearchParams(params);
    updated.set("format", next);
    setParams(updated, { replace: true });
  };
  const setView = (next: RankingView) => {
    const updated = new URLSearchParams(params);
    updated.delete("trend");
    if (next === "trend") updated.set("view", "trend");
    else updated.delete("view");
    setParams(updated, { replace: true });
  };
  // The trend chart belongs to the official data only.
  const leaveTrend = (_source: string, next: URLSearchParams) => {
    next.delete("view");
    next.delete("trend");
  };
  const ranking = useRanking(format);
  const metaView = readMetaView(params);
  const tt = useTopT();
  // Top Meta loads only while it is on screen or the in-game grid compares against it.
  const top = useTopRanking(format, metaView.source === "top" ? metaView.scope : "season",
    view === "list" && (metaView.source === "top" || metaView.compare));
  const shown = metaView.source === "top" ? top : ranking;
  const rows = useMemo<CardRow[]>(() => {
    if (metaView.source === "top") {
      if (top.status !== "ready" || !top.data) return EMPTY_RANKING;
      return top.data.rows.map((r) => ({
        ...r,
        share: r.tier === "count" ? tt("top.teams").replace("{n}", String(r.teams)) : `${r.share.toFixed(1)}%`,
        delta: metaView.compare ? {
          value: r.ingameRank == null ? null : fromView(r.rankDelta, "top"),
          minor: Boolean(r.withinNoise),
          title: r.ingameRank == null ? tt("top.notIn.ingame")
            : r.rankDelta == null ? `${tt("top.rankIn.ingame").replace("{rank}", String(r.ingameRank))} · ${tt("top.fewSamples")}`
            : tt("top.rankIn.ingame").replace("{rank}", String(r.ingameRank)),
        } : undefined,
      }));
    }
    if (ranking.status !== "ready") return EMPTY_RANKING;
    const topByName = metaView.compare && top.status === "ready" && top.data
      ? new Map(top.data.rows.map((r) => [r.name, r])) : null;
    return ranking.data.rows.map((r) => {
      if (!topByName) return r;
      const other = topByName.get(r.name);
      return { ...r, delta: {
        value: other ? fromView(other.rankDelta, "ingame") : null,
        minor: Boolean(other?.withinNoise),
        title: !other ? tt("top.notIn.top")
          : other.rankDelta == null ? `${tt("top.rankIn.top").replace("{rank}", String(other.rank))} · ${tt("top.fewSamples")}`
          : tt("top.rankIn.top").replace("{rank}", String(other.rank)),
      } };
    });
  }, [metaView.source, metaView.compare, top, ranking, tt]);
  const cards = useProgressiveRows(rows);
  const linkView = metaViewQuery(params);
  const rails = useMetaRails();
  useRailEscape(rails);
  const { lang } = useLang();
  const t = useT();

  return (
    <>
      <RailHandle state={rails} label={t("rail.search")} />
      <MetaRail state={rails} format={format} ranking={ranking} />
      <PageHeader className="meta-ranking-header" title={t(view === "trend" ? "trend.title" : "ranking.title")}
        titleAside={<>
          <div className="meta-ranking-sources">
            <SourceSwitch className="page-tabs" onSource={leaveTrend} />
            {metaView.source === "top" ? <ScopeSwitch className="page-tabs" /> : (
              <button type="button" className="meta-chip meta-trend-toggle page-tabs" aria-pressed={view === "trend"}
                      onClick={() => setView(view === "trend" ? "list" : "trend")}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 12.5 6 8l3 2.5 4.5-6" /></svg>
                {tt("top.trend")}
                <span className="meta-chip-track" aria-hidden="true"><i /></span>
              </button>
            )}
            {view !== "trend" && <CompareToggle />}
          </div>
        </>}>
        <MetaNotes className="meta-ranking-notes"
                   sample={metaView.source === "top" && top.status === "ready" && top.data ? top.data.sample : undefined} />
        <FormatTabs format={format} onChange={setFormat} className="page-tabs" />
      </PageHeader>
      <div>
      {view === "trend" && (
        <Suspense fallback={<div className="spinner">{t("state.loading")}</div>}>
          <TrendView format={format} />
        </Suspense>
      )}
      {view === "list" && shown.status === "loading" && <div className="spinner">{t("state.loading")}</div>}
      {view === "list" && shown.status === "error" && (
        <div className="notice">
          {metaView.source === "top" && shown.httpStatus === 404 ? tt("top.unavailable") : t("state.errorDetail")}
        </div>
      )}
      {view === "list" && shown.status === "ready" && (
        <div className="dex-grid dense">
          {cards.rows.map((row) => {
            const assetKey = row.key ?? `pokemon:${row.slug}`;
            return (
            <Link key={row.slug} to={`/meta/${row.slug}?format=${format}${linkView}`}
              className="panel dex-card ranked">
              <RankBadge rank={row.rank} />
              {row.delta && (
                <RankDeltaChip delta={row.delta.value} minor={row.delta.minor} title={row.delta.title} />
              )}
              <GameImage assetKey={assetKey} role="card"
                alt={displayName(row, lang)} className="sprite" />
              <span className="nm">{displayName(row, lang)}</span>
              <span className="types">
                {(row.types ?? []).map((tp) => (
                  <TypeBadge key={tp} type={tp} iconOnly />
                ))}
                {row.share && <ShareTag text={row.share} />}
              </span>
            </Link>
            );
          })}
        </div>
      )}
      {view === "list" && <MoreRows list={cards} />}
      </div>
    </>
  );
}
