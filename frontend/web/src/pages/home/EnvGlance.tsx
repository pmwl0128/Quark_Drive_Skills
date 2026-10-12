/** The home page's metagame glance: each format's top ten as text, how far each moved over the trend
 * window, and the larger moves further down the top 30. Rows read the ranking (rank and types) and the
 * small rank-trend file; no sprite is drawn, so the home page stays light, and a failure stays inside
 * its own half. Moves follow the environment page's rules: compared with the first period of the
 * window, direction by glyph in a neutral colour (a rank change is not a grade), no change left blank. */
import type { FormatId, RankingDto, TrendDto } from "@pokemon-champions/protocol";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { typeColor } from "../../assets/icons.ts";
import { useRanking, useTrend } from "../../hooks.ts";
import { displayName, useLang, type Lang } from "../../i18n.ts";
import { useGlanceT } from "./messages.ts";

const TOP = 10;
const WATCH = 30;
const MOVERS = 5;

type Move = number | "new" | null;

/** Rank change per slug: first period of the window against the latest. */
function moves(trend: TrendDto | null): Map<string, Move> {
  const out = new Map<string, Move>();
  if (!trend || trend.periods.length < 2) return out;
  const last = trend.periods.length - 1;
  for (const series of trend.series) {
    const now = series.ranks[last];
    if (now == null) continue;
    const then = series.ranks[0];
    out.set(series.slug, then == null ? "new" : then - now);
  }
  return out;
}

/** The larger moves among ranks 11–30, which the top-ten list does not show. */
function movers(trend: TrendDto | null, lang: Lang) {
  if (!trend || trend.periods.length < 2) return [];
  const last = trend.periods.length - 1;
  return trend.series
    .flatMap((series) => {
      const now = series.ranks[last];
      if (now == null || now <= TOP || now > WATCH) return [];
      const then = series.ranks[0];
      const move: Move = then == null ? "new" : then - now;
      if (move !== "new" && Math.abs(move) < 2) return [];
      return [{ slug: series.slug, name: displayName(series, lang), rank: now, move }];
    })
    .sort((a, b) => weight(b.move) - weight(a.move) || a.rank - b.rank)
    .slice(0, MOVERS);
}

const weight = (move: Move) => move === "new" ? Infinity : Math.abs(move ?? 0);

/** "2026-10-08" -> "10-08": the year is the snapshot's own. */
const shortDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(5) : date;

function MoveMark({ move }: { move: Move | undefined }) {
  const t = useGlanceT();
  if (move === "new") return <span className="home-move new">{t("glance.new")}</span>;
  if (!move) return <span className="home-move" />;
  const up = move > 0;
  return (
    <span className="home-move">
      <span aria-hidden="true">{up ? "▲" : "▼"}{Math.abs(move)}</span>
      <span className="sr-only">{t(up ? "glance.up" : "glance.down").replace("{n}", String(Math.abs(move)))}</span>
    </span>
  );
}

function TypeTick({ types }: { types: string[] }) {
  const [first, second] = types;
  if (!first) return <span className="home-type-tick" aria-hidden="true" />;
  return (
    <span className="home-type-tick" aria-hidden="true"
      style={{ "--t1": typeColor(first), "--t2": typeColor(second ?? first) } as CSSProperties} />
  );
}

function Rows({ ranking, trend, format }: { ranking: RankingDto; trend: TrendDto | null; format: FormatId }) {
  const { lang } = useLang();
  const moved = moves(trend);
  return (
    <ol className="home-glance-list">
      {ranking.rows.slice(0, TOP).map((row) => (
        <li key={row.slug}>
          <span className="home-glance-rank num">{row.rank}</span>
          <TypeTick types={row.types ?? []} />
          <Link className="home-glance-name" to={`/meta/${row.slug}?format=${format}`}>{displayName(row, lang)}</Link>
          <MoveMark move={moved.get(row.slug)} />
        </li>
      ))}
    </ol>
  );
}

function FormatGlance({ format }: { format: FormatId }) {
  const t = useGlanceT();
  const { lang } = useLang();
  const ranking = useRanking(format);
  const trendState = useTrend(format);
  const trend = trendState.status === "ready" ? trendState.data : null;
  const headId = `home-glance-${format}`;
  const since = trend && trend.periods.length > 1 ? trend.periods[0]! : null;
  const moving = movers(trend, lang);

  return (
    <section className="home-glance-half" aria-labelledby={headId} aria-busy={ranking.status === "loading"}>
      <header className="home-glance-head">
        <h3 id={headId}>{t(`format.${format}`)}</h3>
        {since && <span className="home-glance-since num">{t("glance.since").replace("{date}", shortDate(since))}</span>}
      </header>
      {ranking.status === "loading" && <GlanceSkeleton />}
      {ranking.status === "error" && <p className="home-glance-error">{t("glance.error")}</p>}
      {ranking.status === "ready" && <Rows ranking={ranking.data} trend={trend} format={format} />}
      {moving.length > 0 && (
        <div className="home-glance-movers">
          <span className="home-glance-movers-label">{t("glance.movers")}</span>
          <ul>
            {moving.map((mover) => (
              <li key={mover.slug}>
                <Link to={`/meta/${mover.slug}?format=${format}`}>{mover.name}</Link>
                <span className="home-glance-rank num">#{mover.rank}</span>
                <MoveMark move={mover.move} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <nav className="home-glance-links" aria-label={t(`format.${format}`)}>
        <Link to={`/ranking?format=${format}`}>{t("glance.ranking")}</Link>
        <Link to={`/ranking?view=trend&format=${format}`}>{t("glance.trend")}</Link>
      </nav>
    </section>
  );
}

function GlanceSkeleton() {
  return (
    <ol className="home-glance-list skeleton" aria-hidden="true">
      {Array.from({ length: TOP }, (_, i) => <li key={i}><span className="home-glance-bar" /></li>)}
    </ol>
  );
}

export function EnvGlance() {
  return (
    <>
      <FormatGlance format="single" />
      <FormatGlance format="double" />
    </>
  );
}
