/** Opponent matchup grid (the team skill's M5 reference cache). Two views over one dataset:
 *  - KO 表:   attacker i's hardest move vs defender j's standard set — the stored offense/KO grid.
 *  - Check 表: derived C2/C1/C0 check grades over attacker×attacker pairs.
 * Rows and columns are the meta top-K; cells are colored by KO bucket / check grade, and clicking
 * a cell opens its facts. Every cell is `low` confidence (retained observed builds, NOT your team) —
 * surfaced up top, never hidden. Available on either runtime when team.matchup is advertised. */
import type {
  FormatId, OppCheckGridDto, OppKoGridDto, OppKoSummaryDto,
  OppOffenseDto, OppSetDto,
  SpeciesRowDto,
} from "@pokemon-champions/protocol";
import "../styles.matchup.css";
import type { ReactNode } from "react";
import {
  lazy, memo, Suspense, useMemo, useState, type Dispatch, type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import { stashDamageFill } from "../lib/team.ts";
import { FormatTabs } from "../components/FormatTabs.tsx";
import { useCellHistory } from "../lib/useCellHistory.ts";
import { GameImage } from "../components/GameImage.tsx";
import { activeKey, ColHead, RowHead } from "../components/MatchupHeads.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { SegmentedControl, segmentedPanelId, segmentedTabId }
  from "../components/SegmentedControl.tsx";
import { useOppChecks, useOppDetails, useOppKo, useOppSets } from "../hooks.ts";
import { useRuntime } from "../runtime/context.tsx";
import { displayName, useLang, type Lang } from "../i18n.ts";
import { useMatchupT } from "./matchup/messages.ts";
import { useDamageText } from "../lib/damageText.tsx";
import { koTone } from "../lib/ko.ts";
import { populatedAxes } from "../lib/matchupGrid.ts";
import {
  CellInspector, InspectorMon, InspectorToolbar, type InspectorBuild, type InspectorDamage,
} from "../components/CellInspector.tsx";

// Actual-set input owns large editors, vocabularies and the shared search rail. Keep all of it out
// of the default KO/check graph until that tab is selected.
const ActualMatchupWorkspace = lazy(() => import("./ActualMatchupWorkspace.tsx")
  .then((module) => ({ default: module.ActualMatchupWorkspace })));

function offenseKoChance(off: Pick<OppOffenseDto,
  "ko" | "koChance" | "koGuaranteed" | "koPossible">) {
  if (off.koChance) return off.koChance;
  // No engine verdict: fall back to the static rolls, where "guaranteed" means the WORST roll also
  // kills in that many turns. `koGuaranteed != null` was not that test — it labelled a 乱2 as 确2.
  const g = off.koGuaranteed, p = off.koPossible;
  const guaranteed = g != null && (p == null || g === p);
  return { text: off.ko, n: guaranteed ? g : (p ?? g ?? undefined), guaranteed };
}

/** An opponent-cache offense fact in the inspector's shape. One place decides 确 vs 乱 (always the
 * engine's recovery-aware verdict when present) and collects the caveats, so no grid can drift. */
function inspectorDamage(off: OppOffenseDto | null | undefined,
                         t: (k: never) => string,
                         damageText: ReturnType<typeof useDamageText>): InspectorDamage | null {
  if (!off) return null;
  const caveats: string[] = [];
  if (off.disguiseAdjusted) caveats.push(t("calc.disguiseAdjusted" as never));
  for (const cv of off.koCaveats ?? []) caveats.push(damageText.caveat(cv));
  return {
    move: off.move, minPercent: off.minPercent, maxPercent: off.maxPercent,
    ko: offenseKoChance(off), caveats,
  };
}

// The cache stores species name-sorted (stable git diffs); the grid orders by usage rank so the
// most-used mons sit top-left. Unranked rows sink to the end.
const byRank = (a: SpeciesRowDto, b: SpeciesRowDto): number =>
  (a.rank ?? 1e9) - (b.rank ?? 1e9);

/** The processed set one side was computed with. Public projections strip its provenance fields
 * while retaining the battle inputs needed by the detail panel and calculator hand-off (§7.1). */
const speciesSlug = (key: string, set: OppSetDto | undefined): string => {
  const name = set?.runForm || set?.species
    || (key.startsWith("variant:")
      ? (key.slice("variant:".length).split("|", 1)[0] ?? key) : key);
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
};

/** stashDamageFill side coordinates from an opponent-cache set. Cache keys may be variant ids;
 * the calculator coordinate must always be the dex species/form slug. */
function fillFromSet(key: string, set: OppSetDto | undefined) {
  return {
    slug: speciesSlug(key, set),
    ...(set?.ability ? { ability: set.ability } : {}),
    ...(set?.item ? { item: set.item } : {}),
    ...(set?.nature ? { nature: set.nature } : {}),
    ...(set?.sps ? { sps: set.sps as Record<string, number> } : {}),
  };
}

function CellCalculate({ sets, aSlug, bSlug, format, move }: {
  sets: Record<string, OppSetDto> | undefined;
  aSlug: string; bSlug: string;
  format: FormatId;
  /** The cell's own move: pre-selected in the calculator hand-off. */
  move?: string | null;
}) {
  const t = useMatchupT();
  const navigate = useNavigate();
  if (!sets || (!sets[aSlug] && !sets[bSlug])) return null;
  return (
    <button type="button" className="second-btn md-verify"
            onClick={() => {
              const attacker = fillFromSet(aSlug, sets[aSlug]);
              stashDamageFill({
                format, attackerSlug: attacker.slug,
                attacker,
                defender: fillFromSet(bSlug, sets[bSlug]),
                ...(move ? { move } : {}),
              });
              navigate("/calc?tab=damage");
            }}>
      {t("matchup.calculate")}
    </button>
  );
}

function DetailMon({ s, lang, build }: { s: SpeciesRowDto; lang: Lang; build: InspectorBuild }) {
  return (
    <InspectorMon build={build}>
      <span className="prose-mon">
        <GameImage assetKey={`pokemon:${s.slug}`} role="dense" alt=""
                   className="prose-mon-img" />
        {displayName(s, lang)}
      </span>
    </InspectorMon>
  );
}







/** Detail-panel heading for a selected cell side. The cell's coordinates are VARIANT keys, so the
 * species must be resolved through the variant map (the roster is species-keyed — reading it with a
 * variant key returned undefined and crashed the panel). The build is appended when it is not the
 * default, since "Staraptor" alone would not say which of its builds this row is. */
function variantTitle(s: SpeciesRowDto | undefined, set: OppSetDto | undefined,
                      lang: Lang): string {
  if (!s) return set?.species ?? "—";
  const name = displayName(s, lang);
  return set?.item && set.isModal === false ? `${name} · ${set.item}` : name;
}

function inspectorBuild(key: string, set: OppSetDto | undefined,
                        species: SpeciesRowDto | undefined, lang: Lang): InspectorBuild {
  const label = variantTitle(species, set, lang);
  if (!set) return { label, option: null };
  const rawIndex = species?.variants?.findIndex((variant) => variant.key === key) ?? -1;
  const index = Math.max(0, rawIndex);
  const variant = rawIndex >= 0 ? species?.variants?.[rawIndex] : undefined;
  return {
    label,
    index,
    option: {
      key,
      source: "aggregate",
      coverage: variant?.coverage ?? set.coverage ?? null,
      isModal: variant?.isModal ?? set.isModal ?? false,
      set,
      labelIndex: index,
    },
  };
}

function inspectorBuilds(sets: Record<string, OppSetDto> | undefined,
                         aKey: string, bKey: string,
                         aSpecies: SpeciesRowDto | undefined,
                         bSpecies: SpeciesRowDto | undefined,
                         lang: Lang): InspectorBuild[] {
  return [
    inspectorBuild(aKey, sets?.[aKey], aSpecies, lang),
    inspectorBuild(bKey, sets?.[bKey], bSpecies, lang),
  ];
}

/** Mount the destination immediately so scrolling never waits for a network request or schema
 * validation. Each card subscribes to a shared species shard; adding one does not reload the
 * matrix or the other cards. Keep its heading and two direction lines stable while loading. */
function ReferenceDetail({ format, a, d, left, right, sets, check, onRemove, panelRef }: {
  format: FormatId; a: string; d: string; left: SpeciesRowDto; right: SpeciesRowDto;
  sets: Record<string, OppSetDto> | undefined;
  check?: CheckCell;
  onRemove: () => void;
  panelRef?: (node: HTMLDivElement | null) => void;
}) {
  const state = useOppDetails(format, left.slug);
  const cache = state.status === "ready" ? state.data : null;
  const cell = cache?.matrix[a]?.[d];
  const { lang } = useLang();
  const t = useMatchupT();
  const damageText = useDamageText();
  const builds = inspectorBuilds(sets, a, d, left, right, lang);
  return <CellInspector
    onRemove={onRemove} panelRef={panelRef} loading={state.status === "loading"}
    head={<><DetailMon s={left} lang={lang} build={builds[0]!} /> {t("matchup.vs")}{" "}
           <DetailMon s={right} lang={lang} build={builds[1]!} /></>}
    grade={check?.grade}
    gradeFacts={[
      check?.c0Kind === "wall_no_ko" ? <>· {t("matchup.c0Kind.wall_no_ko")}</> : null,
      check?.contested ? <>· {t("matchup.resolvability.contested")}</> : null,
    ].filter(Boolean) as ReactNode[]}
    directions={[
      { label: t("matchup.ourKo"), damage: inspectorDamage(cell?.offense, t, damageText) },
      { label: t("matchup.incoming"), damage: inspectorDamage(cache?.matrix[d]?.[a]?.offense, t, damageText) },
    ]}
    speed={{ mine: cell?.speed.attacker ?? null, theirs: cell?.speed.defender ?? null,
      fasterName: cell?.speed.faster === "attacker" ? displayName(left, lang)
        : cell?.speed.faster === "defender" ? displayName(right, lang) : null }}
    builds={builds}
    calculate={cell && <CellCalculate sets={sets} aSlug={a} bSlug={d}
      format={format} move={cell.offense?.move} />}
    extra={state.status === "error" ? <span role="alert">{t("state.errorDetail")}</span> : undefined}
  />;
}





// -- grid rows ----------------------------------------------------------------------------------

/** What a grid row needs from its grid. Everything is stable across renders (state setters, the
 * memoized view's arrays, the downloaded document's row), so a selected cell or an opened header
 * re-renders only the rows it touches — not all 3,600 cells. */
interface GridRowProps<Cell> {
  r: SpeciesRowDto;
  rk: string;
  cols: SpeciesRowDto[];
  colKeys: string[];
  cells: Record<string, Cell | null> | undefined;
  /** The selected cell's column when the selection is in this row. */
  selCol: string | null;
  lang: Lang;
  picks: Record<string, string>;
  sets: Record<string, OppSetDto> | undefined;
  setsBusy: boolean;
  open: boolean;
  setOpenPicker: Dispatch<SetStateAction<string | null>>;
  setPicks: Dispatch<SetStateAction<Record<string, string>>>;
}

function GridRowHead({ r, lang, picks, sets, setsBusy, open, setOpenPicker, setPicks, selCol }: GridRowProps<unknown>) {
  return (
    <RowHead selected={selCol !== null} s={r} lang={lang} picks={picks} sets={sets} setsBusy={setsBusy} showSetHover open={open}
             onToggle={() => setOpenPicker((k) => k === `row:${r.slug}` ? null : `row:${r.slug}`)}
             onPick={(key) => setPicks((p) => ({ ...p, [r.slug]: key }))}
             onClose={() => setOpenPicker(null)} />
  );
}

const KoRow = memo(function KoRow(props: GridRowProps<OppKoSummaryDto> & {
  setSel: (value: { a: string; d: string }) => void;
}) {
  const { rk, cols, colKeys, cells, selCol, lang, setSel } = props;
  const damageText = useDamageText();
  return (
    <tr>
      <GridRowHead {...(props as GridRowProps<unknown>)} />
      {cols.map((c, index) => {
        const ck = colKeys[index]!;
        // Only the true self-pair is blanked. Two BUILDS of one species face each other
        // for real, and so does a build against its own mirror — but a cell comparing a
        // build to itself carries no information the row header doesn't already give.
        // The mirror IS computed (a build against its own twin is a real matchup and a
        // direct read on its bulk-vs-power balance), so it renders like any other cell —
        // only outlined so the same-build case stays legible.
        const o: OppKoSummaryDto | null = cells?.[ck] ?? null;
        if (!o) return <td key={c.slug} className="ko-none" />;
        // Community 确N/乱N: 确N when even the WORST roll KOes in N
        // (koGuaranteed === koPossible); 乱N shows the BEST-roll turn count when
        // the worst roll needs more (e.g. 45–51% => 确3 by rolls, 乱2 shown).
        // koExact only says the 2+ turn number is a static approximation — it is
        // NOT the guaranteed/possible split (earlier bug).
        // "Guaranteed" must agree with the recovery-aware verdict, not just with the
        // static rolls: a defender holding Leftovers can turn a static 2HKO into an 87.5%
        // chance, and the grade already reads it that way. Labelling that cell 确2 while
        // the check grid called the kill uncertain made the two tables contradict.
        const [minPercent, maxPercent, kp, g, chanceN, chanceGuaranteed,
          chancePct] = o;
        const chance = chanceN != null || chanceGuaranteed != null || chancePct != null
          ? { text: "", ...(chanceN != null ? { n: chanceN } : {}),
              ...(chanceGuaranteed != null ? { guaranteed: chanceGuaranteed } : {}),
              ...(chancePct != null ? { chancePct } : {}) }
          : null;
        const certain = chance != null
          ? chance.guaranteed === true
          : g != null && (kp == null || g === kp);
        const turns = chance?.n ?? (certain ? g : kp);
        const tone = koTone(turns, certain, maxPercent);
        const on = selCol === ck;
        return (
          <td key={c.slug} className={`ko-${tone}${ck === rk ? " mirror" : ""}${on ? " on" : ""}`}
            title={`${minPercent}–${maxPercent}% · ${damageText.ko(chance ?? {
              text: "", n: certain ? (g ?? undefined) : (kp ?? g ?? undefined),
              guaranteed: certain,
            })}`}
            role="button" tabIndex={0} aria-pressed={on}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault(); setSel({ a: rk, d: ck });
              }
            }}
            onClick={() => setSel({ a: rk, d: ck })}>
            {tone === "immune"
              ? "0"
              : turns != null
                ? certain
                  ? lang === "en" ? turns : lang === "ja" ? `確${turns}` : `确${turns}`
                  : lang === "en" ? `~${turns}` : `乱${turns}`
                : ""}
          </td>
        );
      })}
    </tr>
  );
});

type CheckCell = OppCheckGridDto["grid"][string][string];

const CheckRow = memo(function CheckRow(props: GridRowProps<CheckCell> & {
  setSel: (value: { m: string; o: string }) => void;
}) {
  const { rk, cols, colKeys, cells, selCol, setSel } = props;
  const t = useMatchupT();
  return (
    <tr>
      <GridRowHead {...(props as GridRowProps<unknown>)} />
      {cols.map((c, index) => {
        // Each cell is exactly the two builds it names — the grid holds every ordered build pair,
        // so a column reads its own build rather than an aggregate over the species.
        const ck = colKeys[index]!;
        const cl = cells?.[ck] ?? null;
        const g = cl?.grade;
        if (!g) return <td key={c.slug} className="ko-none" />;
        const wall = g === "C0" && cl!.c0Kind === "wall_no_ko";
        const contested = !!cl!.contested;
        const on = selCol === ck;
        return (
          <td key={c.slug}
            className={`grade-${g}${wall ? " wall" : ""}${contested ? " contested" : ""}${on ? " on" : ""}`}
            title={`${g}${contested ? ` · ${t("matchup.contested")}` : ""}`}
            role="button" tabIndex={0} aria-pressed={on}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault(); setSel({ m: rk, o: ck });
              }
            }}
            onClick={() => setSel({ m: rk, o: ck })}>
            {g}
          </td>
        );
      })}
    </tr>
  );
});

// -- KO / offense grid --------------------------------------------------------------------------

const koCellKey = (cell: { a: string; d: string }) => JSON.stringify([cell.a, cell.d]);
const checkCellKey = (cell: { m: string; o: string }) => JSON.stringify([cell.m, cell.o]);

function KoGrid({ format }: { format: FormatId }) {
  const state = useOppKo(format);
  const buildState = useOppSets(format);
  const headerSets = buildState.status === "ready" ? buildState.data.sets : undefined;
  const { lang } = useLang();
  const t = useMatchupT();
  const history = useCellHistory(format, koCellKey);
  const sel = history.selected;
  const setSel = history.append;
  // speciesSlug -> variantKey, kept SEPARATELY per axis: a Pokemon read as one build while
  // attacking and another while defending is a normal thing to want, and sharing one map made
  // picking an attacker build silently rewrite the defender column too.
  const [rowPicks, setRowPicks] = useState<Record<string, string>>({});
  const [colPicks, setColPicks] = useState<Record<string, string>>({});
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  // The 40k-cell axis scan and variant index depend only on the downloaded overview. Build picks
  // merely select one key per species and must not redo that work on every picker click.
  const prepared = useMemo(() => {
    if (state.status !== "ready") return null;
    const overview: OppKoGridDto = state.data;
    const all = [...overview.species].sort(byRank);
    // Meta-only sets remain valid defender columns (incoming damage needs no stitched move list),
    // while only real joint four-move sets become attacker rows. Independently, do not render an
    // all-empty axis when every calculation for an active build failed or was unavailable: absence
    // is not damage data.
    const available = populatedAxes(overview.grid);
    // Variant key -> its species row, so the detail panel can name a selected cell whose
    // coordinates are variant keys rather than species slugs.
    const byVariant = new Map<string, SpeciesRowDto>();
    for (const sp of overview.species) {
      for (const v of sp.variants ?? []) byVariant.set(v.key, sp);
      byVariant.set(sp.slug, sp);                     // legacy grid: key IS the species slug
    }
    return { overview, all, available, byVariant };
  }, [state]);

  const view = useMemo(() => {
    if (!prepared) return null;
    const { overview, all, available, byVariant } = prepared;
    const cols = all.filter((s) => available.cols.has(activeKey(s, colPicks)));
    // Attacker rows are decided by the ACTIVE build: switching a species to a build that has no
    // offense row (meta-only) correctly drops it from the rows.
    const rows = all.filter((s) => available.rows.has(activeKey(s, rowPicks)));
    const colKeys = cols.map((c) => activeKey(c, colPicks));
    return { overview, cols, colKeys, rows, byVariant, omittedCols: all.length - cols.length };
  }, [prepared, rowPicks, colPicks]);

  if (state.status === "loading") return <div className="spinner">{t("state.loading")}</div>;
  if (state.status === "error") {
    return <div className="notice">{state.httpStatus === 404
      ? t("matchup.notBuilt")
      : t("state.errorDetail")}</div>;
  }
  if (!view) return null;
  const { overview, cols, colKeys, rows, byVariant, omittedCols } = view;

  return (
    <>
      <div className={`matrix-guide${sel ? " active" : ""}`} aria-live="polite">
        <span className="matrix-guide-mark" aria-hidden>{sel ? "✓" : "↘"}</span>
        {t(sel ? "matchup.cellSelected" : "matchup.cellHint")}
      </div>
      {omittedCols > 0 && (
        <div className="matrix-guide variant-guide">
          <span className="matrix-guide-mark" aria-hidden>−</span>
          {t("matchup.omittedNoSet").replace("{count}", String(omittedCols))}
        </div>
      )}
      <div className="matchup-scroll">
        <table className="matchup-grid">
          <thead>
            <tr>
              <th className="corner">{t("matchup.attacker")} \ {t("matchup.defender")}</th>
              {cols.map((c) => (
                <ColHead selected={!!sel && activeKey(c, colPicks) === sel.d} key={c.slug} s={c} lang={lang} picks={colPicks}
                         sets={headerSets} setsBusy={buildState.status === "loading"} showSetHover
                         open={openPicker === `col:${c.slug}`}
                         onToggle={() => setOpenPicker((k) => k === `col:${c.slug}` ? null : `col:${c.slug}`)}
                         onPick={(key) => setColPicks((p) => ({ ...p, [c.slug]: key }))}
                         onClose={() => setOpenPicker(null)} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rk = activeKey(r, rowPicks);
              return (
                <KoRow key={r.slug} r={r} rk={rk} cols={cols} colKeys={colKeys} cells={overview.grid[rk]}
                  selCol={sel?.a === rk ? sel.d : null} lang={lang} picks={rowPicks} sets={headerSets}
                  setsBusy={buildState.status === "loading"} open={openPicker === `row:${r.slug}`}
                  setOpenPicker={setOpenPicker} setPicks={setRowPicks} setSel={setSel} />
              );
            })}
          </tbody>
        </table>
      </div>
      <InspectorToolbar onClear={history.clear} empty={!history.entries.length}><KoLegend /></InspectorToolbar>
      <div className="matchup-details">{history.entries.map(({ id, value: cell }) => {
        const left = byVariant.get(cell.a), right = byVariant.get(cell.d);
        // An expiry can remove handover-only builds while the format and history stay mounted.
        if (!left || !right || !overview.grid[cell.a]?.[cell.d]) return null;
        return <ReferenceDetail key={id} format={format} a={cell.a} d={cell.d}
          left={left} right={right} sets={headerSets}
          onRemove={() => history.remove(id)}
          panelRef={id === history.activeId ? history.panelRef : undefined} />;
      })}</div>
    </>
  );
}

function KoLegend() {
  const t = useMatchupT();
  const tones: Array<["ohkoG" | "ohko" | "2hko" | "3hko" | "4hko" | "slow", string]> = [
    ["ohkoG", "OHKO"], ["2hko", "2HKO"], ["3hko", "3HKO"], ["4hko", "4HKO"], ["slow", "5+"],
  ];
  return (
    <div className="legend">
      <span className="muted">{t("matchup.koLegend")}:</span>
      {tones.map(([tone, lbl]) => <span key={tone} className={`chip ko-${tone}`}>{lbl}</span>)}
      <span className="muted">{t("matchup.koUncertain")}</span>
    </div>
  );
}

// -- Check grid ---------------------------------------------------------------------------------

function CheckGrid({ format }: { format: FormatId }) {
  const state = useOppChecks(format);
  const buildState = useOppSets(format);
  const headerSets = buildState.status === "ready" ? buildState.data.sets : undefined;
  const history = useCellHistory(format, checkCellKey);
  const sel = history.selected;
  const setSel = history.append;
  const { lang } = useLang();
  const t = useMatchupT();
  const [rowPicks, setRowPicks] = useState<Record<string, string>>({});
  const [colPicks, setColPicks] = useState<Record<string, string>>({});
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  // Keep the full-grid preparation independent from the cheap active-build projection below.
  const prepared = useMemo(() => {
    if (state.status !== "ready") return null;
    const checks: OppCheckGridDto = state.data;
    const all = [...checks.species].sort(byRank);
    // Every grade is derived from an ordered ATTACKER pair, so a build with no offense row is
    // neither a row nor a column here — leaving it in painted a blank column across the table.
    const available = populatedAxes(checks.grid);
    const byVariant = new Map<string, SpeciesRowDto>();
    for (const sp of checks.species) {
      for (const v of sp.variants ?? []) byVariant.set(v.key, sp);
      byVariant.set(sp.slug, sp);
    }
    return { checks, all, available, byVariant };
  }, [state]);

  const view = useMemo(() => {
    if (!prepared) return null;
    const { checks, all, available, byVariant } = prepared;
    const cols = all.filter((s) => available.cols.has(activeKey(s, colPicks)));
    const rows = all.filter((s) => available.rows.has(activeKey(s, rowPicks)));
    const colKeys = cols.map((c) => activeKey(c, colPicks));
    return { checks, cols, colKeys, rows, byVariant, omittedCols: all.length - cols.length };
  }, [prepared, rowPicks, colPicks]);

  if (state.status === "loading") return <div className="spinner">{t("state.loading")}</div>;
  if (state.status === "error") {
    return <div className="notice">{state.httpStatus === 404
      ? t("matchup.notBuilt")
      : t("state.errorDetail")}</div>;
  }
  if (!view) return null;
  const { checks, cols, colKeys, rows, byVariant, omittedCols } = view;

  return (
    <>
      <div className={`matrix-guide${sel ? " active" : ""}`} aria-live="polite">
        <span className="matrix-guide-mark" aria-hidden>{sel ? "✓" : "↘"}</span>
        {t(sel ? "matchup.cellSelected" : "matchup.cellHint")}
      </div>
      {omittedCols > 0 && (
        <div className="matrix-guide variant-guide">
          <span className="matrix-guide-mark" aria-hidden>−</span>
          {t("matchup.omittedNoSet").replace("{count}", String(omittedCols))}
        </div>
      )}
      <div className="matchup-scroll">
        <table className="matchup-grid">
          <thead>
            <tr>
              <th className="corner">{t("matchup.member")} \ {t("matchup.opponent")}</th>
              {cols.map((c) => (
                <ColHead selected={!!sel && activeKey(c, colPicks) === sel.o} key={c.slug} s={c} lang={lang}
                         sets={headerSets} setsBusy={buildState.status === "loading"} showSetHover
                         picks={colPicks}
                         open={openPicker === `col:${c.slug}`}
                         onToggle={() => setOpenPicker((k) => k === `col:${c.slug}` ? null : `col:${c.slug}`)}
                         onPick={(key) => setColPicks((p) => ({ ...p, [c.slug]: key }))}
                         onClose={() => setOpenPicker(null)} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rk = activeKey(r, rowPicks);
              return (
                <CheckRow key={r.slug} r={r} rk={rk} cols={cols} colKeys={colKeys} cells={checks.grid[rk]}
                  selCol={sel?.m === rk ? sel.o : null} lang={lang} picks={rowPicks} sets={headerSets}
                  setsBusy={buildState.status === "loading"} open={openPicker === `row:${r.slug}`}
                  setOpenPicker={setOpenPicker} setPicks={setRowPicks} setSel={setSel} />
              );
            })}
          </tbody>
        </table>
      </div>
      <InspectorToolbar onClear={history.clear} empty={!history.entries.length}><CheckLegend /></InspectorToolbar>
      <div className="matchup-details">{history.entries.map(({ id, value: cell }) => {
        const left = byVariant.get(cell.m), right = byVariant.get(cell.o);
        if (!left || !right || !checks.grid[cell.m]?.[cell.o]) return null;
        return <ReferenceDetail key={id} format={format} a={cell.m} d={cell.o}
          left={left} right={right} sets={headerSets}
          check={checks.grid[cell.m]?.[cell.o]}
          onRemove={() => history.remove(id)}
          panelRef={id === history.activeId ? history.panelRef : undefined} />;
      })}</div>
    </>
  );
}

function CheckLegend() {
  const t = useMatchupT();
  return (
    <div className="legend">
      <span className="chip grade-C2">C2</span><span className="muted">{t("matchup.c2")}</span>
      <span className="chip grade-C1">C1</span><span className="muted">{t("matchup.c1")}</span>
      <span className="chip grade-C0">C0</span><span className="muted">{t("matchup.c0")}</span>
    </div>
  );
}

// -- page ---------------------------------------------------------------------------------------

export function MatchupPage() {
  const { can } = useRuntime();
  const t = useMatchupT();
  const [format, setFormat] = useState<FormatId>("single");
  const [view, setView] = useState<"ko" | "check" | "actual">(() => {
    const requested = new URLSearchParams(window.location.search).get("mode");
    return requested === "check" || requested === "actual" ? requested : "ko";
  });

  const changeView = (next: "ko" | "check" | "actual") => {
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    window.history.replaceState(window.history.state, "", url);
  };

  if (!can("team.matchup")) return <div className="notice">{t("matchup.unavailable")}</div>;

  return (
    <div className="matchup-page">
      <PageHeader sticky title={t("matchup.title")} description={t("matchup.description")}>
        <SegmentedControl kind="tabs" idBase="matchup-view" value={view} onChange={changeView}
          ariaLabel={t("a11y.matchupView")} className="seg page-tabs" items={[
            { id: "ko", label: t("matchup.ko") },
            { id: "check", label: t("matchup.check") },
            { id: "actual", label: t("actual.tab") },
          ]} />
        <FormatTabs format={format} onChange={setFormat} className="page-tabs" />
      </PageHeader>
      <div role="tabpanel" id={segmentedPanelId("matchup-view", view)}
        aria-labelledby={segmentedTabId("matchup-view", view)}>
        {view === "ko" ? <KoGrid format={format} /> : view === "check"
          ? <CheckGrid format={format} />
          : <Suspense fallback={<div className="spinner">{t("state.loading")}</div>}>
              <ActualMatchupWorkspace format={format} onFormatChange={setFormat} />
            </Suspense>}
      </div>
    </div>
  );
}
