/** Completed matchup tables and cell inspection. Requests and history stay in the workspace. */
import type { ActualDamageFactDto, ActualMatchupCellDto, ActualMatchupResponseDto, FormatId, OppSetDto, SpeciesRowDto } from "@pokemon-champions/protocol";
import { memo, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useCellHistory } from "../../lib/useCellHistory.ts";
import { GameImage } from "../../components/GameImage.tsx";
import { SegmentedControl } from "../../components/SegmentedControl.tsx";
import { useDexByName, useOppSets } from "../../hooks.ts";
import { displayName, useLang } from "../../i18n.ts";
import { useMatchupT } from "./messages.ts";
import { koTone } from "../../lib/ko.ts";
import { readTeamMembers, stashDamageFill, type TeamMemberish } from "../../lib/team.ts";
import { CellInspector, InspectorMon, InspectorToolbar, type InspectorBuild, type InspectorDamage } from "../../components/CellInspector.tsx";
import { activeKey, ColHead } from "../../components/MatchupHeads.tsx";
import { slugify } from "../../components/team/MonChip.tsx";

/** The skill emits the lossless canonical key and the bridge deliberately preserves it. */
const variantKey = (cell: { opponent_variant?: string }, fallback: string): string =>
  cell.opponent_variant ?? fallback;

type ResultView = "check" | "ko";
const actualCellKey = (cell: { sourceId: string; cellId: string }) => JSON.stringify([cell.sourceId, cell.cellId]);

/** Same markup as the reference grids' DetailMon (sprite + localized name in one hover chip), so a
 * cell inspector looks the same wherever it was opened. */
function DetailMon({ name, lang, build }: { name: string; lang: string; build: InspectorBuild }) {
  const dex = useDexByName();
  const row = dex.get(name);
  return (
    <InspectorMon build={build}>
      <span className="prose-mon">
        <GameImage assetKey={`pokemon:${row?.slug ?? slugify(name)}`} role="dense" alt=""
                   className="prose-mon-img" />
        {row ? displayName(row, lang as Parameters<typeof displayName>[1]) : name}
      </span>
    </InspectorMon>
  );
}

/** An actual-battery damage fact in the inspector's shape.
 *
 * The skill emits snake_case; `damageText.ko` reads camelCase, so `chance_pct` silently never
 * reached it and every uncertain kill lost its percentage. It also prefers the engine's
 * recovery-aware verdict over the static rolls: Leftovers turns a static 2HKO into an 87.5%
 * chance, and the grade is computed from that number — labelling the same cell 确2 contradicted it.
 */
function actualDamage(fact: ActualDamageFactDto | null | undefined,
                      t: (k: never) => string): InspectorDamage | null {
  if (!fact) return null;
  const rich = fact.ko_chance;
  const g = fact.ko_guaranteed, p = fact.ko_possible;
  const staticGuaranteed = g != null && (p == null || g === p);
  const ko = rich
    ? { text: rich.text, n: rich.n ?? p ?? g, guaranteed: rich.guaranteed ?? staticGuaranteed,
        chancePct: rich.chance_pct }
    : { text: fact.ko, n: staticGuaranteed ? g : (p ?? g), guaranteed: staticGuaranteed };
  const caveats = fact.ko_exact === false ? [t("matchup.staticApprox" as never)] : [];
  return { move: fact.move, minPercent: fact.min_percent, maxPercent: fact.max_percent,
           ko, caveats };
}

/** The member's own registered set, in the shape the shared build card renders. */
function sourceAsSet(source: TeamMemberish | null | undefined,
                     row: { member_run_form?: string | null; member: string }): OppSetDto | undefined {
  if (!source) return undefined;
  return {
    species: row.member, runForm: row.member_run_form ?? null,
    ability: source.ability ?? null, item: source.item ?? null, nature: source.nature ?? null,
    moves: (source.moves ?? []).filter(Boolean),
    sps: (source.spread ?? null) as Record<string, number> | null,
  };
}

function koTurns(fact: ActualDamageFactDto | null): { turns: number | null; certain: boolean } {
  if (!fact) return { turns: null, certain: false };
  // Prefer the recovery-aware verdict over the static rolls. A defender holding Leftovers can turn
  // a static 2HKO into an 87.5% chance, and the check grade already treats that kill as uncertain —
  // labelling the same cell 确2 made the two tables contradict each other.
  const chance = (fact as { ko_chance?: { n?: number; guaranteed?: boolean } }).ko_chance;
  if (chance && (chance.guaranteed != null || chance.n != null)) {
    return { turns: chance.n ?? fact.ko_possible ?? null, certain: chance.guaranteed === true };
  }
  const guaranteed = fact.ko_guaranteed ?? null;
  const possible = fact.ko_possible ?? null;
  const certain = guaranteed != null && (possible == null || possible === guaranteed);
  return { turns: certain ? guaranteed : possible, certain };
}

export const ActualResult = memo(function ActualResult({ response, format, sourceTeam }: {
  response: ActualMatchupResponseDto; format: FormatId; sourceTeam: unknown;
}) {
  const t = useMatchupT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const dex = useDexByName();
  const opp = useOppSets(format);
  const sets = opp.status === "ready" ? opp.data.sets : undefined;
  const [view, setView] = useState<ResultView>("ko");
  // Which side is ATTACKING. Both directions are already computed per cell (`offense` = ours,
  // `incoming` = theirs), so this is a pure re-read — no second request, no second table. A second
  // table would also be the wrong shape here: sources are few and targets many, so the transpose
  // is very tall and very narrow.
  const [dir, setDir] = useState<"out" | "in">("out");
  const history = useCellHistory<{ sourceId: string; cellId: string; view: ResultView; dir: "out" | "in" }>(response, actualCellKey);
  const selected = history.selected;
  const selectCell = (sourceId: string, cellId: string) => history.append({ sourceId, cellId, view, dir });
  // Which BUILD each opponent column is read as, keyed by dex slug — same model as the reference
  // grids. A ranked opponent expands into one cell per real build; showing them as adjacent columns
  // made the table several times wider and buried the species, so one species is one column and the
  // head switches which of its builds that column shows.
  const [colPicks, setColPicks] = useState<Record<string, string>>({});
  const [openCol, setOpenCol] = useState<string | null>(null);
  const result = response.result;
  const targets = result.members[0]?.cells ?? [];
  const byTarget = useMemo(() => new Map(result.members.map((row) =>
    [row.source_id, new Map(row.cells.map((c) => [c.target_id, c]))])), [result]);
  // One column per SPECIES; its builds become the head's switchable options. Order follows the
  // backend's usage-rank order of first appearance.
  const columns = useMemo(() => {
    const roster = new Map((opp.status === "ready" ? opp.data.species : []).map((r) => [r.slug, r]));
    const at = new Map<string, number>();
    const out: { slug: string; row: SpeciesRowDto; cells: ActualMatchupCellDto[] }[] = [];
    for (const target of targets) {
      const dexRow = dex.get(target.opponent);
      const slug = dexRow?.slug ?? slugify(target.opponent);
      const seen = at.get(slug);
      if (seen != null) { out[seen]!.cells.push(target); continue; }
      at.set(slug, out.length);
      const base = roster.get(slug);
      out.push({
        slug, cells: [target],
        row: base ?? {
          rank: target.usage_rank ?? null, slug, name: target.opponent,
          nameZh: dexRow?.nameZh, nameJa: dexRow?.nameJa, realTeamBacked: false,
        },
      });
    }
    // Offer only the builds this battery actually computed — the cache may know builds that were
    // never run here, and a head listing one would switch the column to an empty cell.
    // Both sides use the skill's lossless canonical variant id unchanged.
    return out.map((c) => {
      const known = new Map((roster.get(c.slug)?.variants ?? []).map((v) => [v.key, v]));
      const variants = c.cells.map((cell) => {
        const key = variantKey(cell, c.slug);
        return known.get(key) ?? {
          key, isModal: cell.opponent_is_modal ?? c.cells.length === 1,
          item: cell.opponent_cluster?.item ?? null,
          ability: cell.opponent_cluster?.ability ?? null,
          runForm: cell.opponent_run_form ?? undefined,
          coverage: null,
        };
      });
      return { ...c, row: { ...c.row, variants } };
    });
  }, [targets, opp, dex]);

  const selectedTarget = selected ? result.members.find((row) => row.source_id === selected.sourceId)
    ?.cells.find((cell) => cell.cell_id === selected.cellId)?.target_id : undefined;

  const mon = (name: string) => {
    const row = dex.get(name);
    return { row, slug: row?.slug ?? slugify(name), label: row ? displayName(row, lang) : name };
  };
  return <section className="actual-results" aria-live="polite">
    <div className="actual-results-head">
      <div><span className="eyebrow">{t("actual.resultEyebrow")}</span><h2>{t("actual.resultTitle")}</h2>
        <p>{t("actual.resultScope").replace("{sources}", String(result.source_count)).replace("{targets}", String(result.top_k))}</p></div>
      <div className="actual-result-tools">
        <span className={`actual-complete ${result.coverage.complete ? "ok" : "warn"}`}>
          {result.coverage.complete ? "✓" : "!"} {t(result.coverage.complete ? "actual.complete" : "actual.partial")}</span>
        <SegmentedControl kind="radio" value={view} onChange={setView} ariaLabel={t("actual.resultView")} className="seg"
          items={[{ id: "ko", label: t("matchup.ko") }, { id: "check", label: t("matchup.check") }]} />
      </div>
    </div>
    <div className="matchup-scroll actual-grid-scroll"><table className="matchup-grid actual-grid">
      {/* A check GRADE already folds both directions in (C2 = survives the switch-in AND kills), so
        * the direction toggle belongs to the KO view only. Layout stays members-as-rows in both
        * directions: a real transpose would be very tall and very narrow (few sources, many targets),
        * so only the damage fact being read changes. */}
      <thead><tr><th className="corner corner-swap">
        {/* Applies to BOTH views: on KO it picks which damage fact to read, on the check view it
          * reads the reverse grade (can the opponent answer US) — two different, both-valid
          * readings. Layout stays members-as-rows either way; a real transpose here would be very
          * tall and very narrow (few sources, many targets). */}
        <button type="button" className="dir-swap"
                onClick={() => { setDir((d) => d === "out" ? "in" : "out"); }}
                title={t("actual.swapHint")} aria-label={t("actual.swap")}>
          <span className="dir-side">{t(dir === "out" ? "matchup.member" : "matchup.opponent")}</span>
          <span className="dir-arrow" aria-hidden>⇄</span>
          <span className="dir-side">{t(dir === "out" ? "matchup.opponent" : "matchup.member")}</span>
        </button>
      </th>
        {columns.map((col) => <ColHead selected={!!selected && col.cells.some((cell) => cell.target_id === selectedTarget)} key={col.slug} s={col.row} lang={lang} picks={colPicks}
          sets={sets} setsBusy={opp.status === "loading"}
          open={openCol === col.slug}
          onToggle={() => setOpenCol((k) => (k === col.slug ? null : col.slug))}
          onClose={() => setOpenCol(null)}
          onPick={(key) => { setColPicks((m) => ({ ...m, [col.slug]: key })); }} />)}
      </tr></thead>
      <tbody>{result.members.map((row) => { const info = mon(row.member_run_form ?? row.member); return <tr key={row.source_id}>
        <th className={`row-head${selected?.sourceId === row.source_id ? " axis-selected" : ""}`} title={row.member_run_form ? `${row.member} → ${info.label}` : info.label}><span className="row-head-inner">
          <GameImage assetKey={`pokemon:${info.slug}`} role="dense" alt="" className="mini" />
          {/* No MEGA badge: the battery substitutes the Mega form silently, so `info.label` ALREADY
            * names it. Badging it again is a marker the reference grids don't carry. */}
          <span className="nm">{info.label}</span>
          </span></th>
        {columns.map((col) => {
          // Read the build this column is switched to, then index BY TARGET, never by array
          // position: the column set comes from members[0], so a row missing one cell (an
          // uncomputable pair) used to shift every later cell one column left and silently
          // mislabel the whole rest of that row.
          const key = activeKey(col.row, colPicks);
          const target = col.cells.find((c) => variantKey(c, col.slug) === key) ?? col.cells[0];
          const item = target && byTarget.get(row.source_id)?.get(target.target_id);
          if (!item) return <td key={col.slug} className="ko-none" />;
          const on = selected?.cellId === item.cell_id && selected.sourceId === row.source_id;
          const activeCheck = dir === "in" ? item.reverse_check : item.check;
          const grade = activeCheck?.grade;
          const wall = grade === "C0" && activeCheck?.c0_kind === "wall_no_ko";
          const contested = !!activeCheck?.contested;
          // Both directions are computed per cell; the swap only chooses which one to read.
          const dmg = dir === "in" ? item.incoming : item.offense;
          const ko = koTurns(dmg);
          const tone = koTone(ko.turns, ko.certain, dmg?.max_percent ?? null);
          const label = view === "check" ? grade ?? "" : ko.turns == null ? "" : ko.certain
            ? lang === "en" ? String(ko.turns) : lang === "ja" ? `確${ko.turns}` : `确${ko.turns}`
            : lang === "en" ? `~${ko.turns}` : `乱${ko.turns}`;
          const cls = view === "check" ? (grade ? `grade-${grade}` : "ko-none") : `ko-${tone}`;
          return <td key={col.slug}
            className={`${cls}${view === "check" && wall ? " wall" : ""}${view === "check" && contested ? " contested" : ""}${on ? " on" : ""}`}
            title={view === "check" && contested ? t("matchup.contested") : undefined}
            role="button" tabIndex={0}
            aria-pressed={on} onClick={() => selectCell(row.source_id, item.cell_id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") {
              e.preventDefault(); selectCell(row.source_id, item.cell_id);
            } }}>{label}</td>;
        })}</tr>; })}</tbody>
    </table></div>
    <InspectorToolbar onClear={history.clear} empty={!history.entries.length}>
    {view === "check" ? <div className="legend"><span className="chip grade-C2">C2</span><span className="muted">{t("matchup.c2")}</span>
      <span className="chip grade-C1">C1</span><span className="muted">{t("matchup.c1")}</span>
      <span className="chip grade-C0">C0</span><span className="muted">{t("matchup.c0")}</span></div>
      : <div className="legend"><span className="muted">{t("matchup.koLegend")}:</span>{["ohkoG", "2hko", "3hko", "4hko", "slow"].map((tone, i) =>
        <span key={tone} className={`chip ko-${tone}`}>{i === 0 ? "OHKO" : i === 4 ? "5+" : `${i + 1}HKO`}</span>)}</div>}
    </InspectorToolbar>
    <div className="matchup-details">{history.entries.map(({ id, value: selected }) => {
      const { view, dir } = selected;
      const selectedRow = result.members.find((row) => row.source_id === selected.sourceId);
      const cell = selectedRow?.cells.find((item) => item.cell_id === selected.cellId) ?? null;
      // Keep the reading captured by this click, even if the table direction later changes.
      const detailCheck = cell ? (dir === "in" ? cell.reverse_check : cell.check) : null;
      const source = selectedRow ? readTeamMembers(sourceTeam)[selectedRow.source_index] : null;
      const selectedMemberName = selectedRow?.member_run_form ?? selectedRow?.member;
      if (!cell || !selectedRow) return null;
      const ours = mon(selectedMemberName!), theirs = mon(cell.opponent);
      const targetKey = variantKey(cell, theirs.slug);
      const targetSet = sets?.[targetKey];
      const sourceSet = sourceAsSet(source, selectedRow);
      const targetSpecies = columns.find((column) => column.slug === theirs.slug)?.row;
      const rawTargetIndex = targetSpecies?.variants?.findIndex(
        (variant) => variant.key === targetKey,
      ) ?? -1;
      const targetIndex = Math.max(0, rawTargetIndex);
      const targetVariant = rawTargetIndex >= 0
        ? targetSpecies?.variants?.[rawTargetIndex] : undefined;
      const builds: InspectorBuild[] = [
        {
          label: ours.label,
          option: sourceSet ? {
            key: "custom:" + selectedRow.source_id,
            source: "custom",
            coverage: null,
            isModal: true,
            set: sourceSet,
          } : null,
        },
        {
          label: theirs.label,
          index: targetIndex,
          option: targetSet ? {
            key: targetKey,
            source: "aggregate",
            coverage: targetVariant?.coverage ?? targetSet.coverage ?? null,
            isModal: targetVariant?.isModal ?? targetSet.isModal ?? false,
            set: targetSet,
            labelIndex: targetIndex,
          } : null,
        },
      ];
      const dirs = [
        { label: t("matchup.ourKo"), damage: actualDamage(cell.offense, t) },
        { label: t("matchup.incoming"), damage: actualDamage(cell.incoming, t) },
      ];
      return (
        <CellInspector
          key={id} onRemove={() => history.remove(id)}
          panelRef={id === history.activeId ? history.panelRef : undefined}
          head={<><DetailMon name={selectedMemberName!} lang={lang} build={builds[0]!} />
                 <span>{t("matchup.vs")}</span>
                 <DetailMon name={cell.opponent} lang={lang} build={builds[1]!} /></>}
          grade={view === "check" ? detailCheck?.grade ?? null : null}
          gradeFacts={view === "check" ? ([
            detailCheck?.c0_kind === "wall_no_ko"
              ? <>· {t("matchup.c0Kind.wall_no_ko")}</> : null,
            detailCheck?.contested ? <>· {t("matchup.resolvability.contested")}</> : null,
          ].filter(Boolean) as ReactNode[]) : undefined}
          directions={dirs}
          speed={{ mine: cell.speed.member, theirs: cell.speed.opponent,
            fasterName: cell.speed.faster === "member" ? ours.label
              : cell.speed.faster === "opponent" ? theirs.label : null }}
          builds={builds}
          calculate={
            <button type="button" className="second-btn md-verify" onClick={() => {
                  const ourSet = { slug: ours.slug,
                    ...(source?.ability && !selectedRow.member_run_form ? { ability: source.ability } : {}),
                    ...(source?.item ? { item: source.item } : {}),
                    ...(source?.nature ? { nature: source.nature } : {}),
                    ...(source?.spread ? { sps: source.spread } : {}) };
                  const theirSet = { slug: theirs.slug,
                    ...(targetSet?.ability ? { ability: targetSet.ability } : {}),
                    ...(targetSet?.item ? { item: targetSet.item } : {}),
                    ...(targetSet?.nature ? { nature: targetSet.nature } : {}),
                    ...(targetSet?.sps ? { sps: targetSet.sps } : {}) };
                  const incoming = cell.incoming;
                  stashDamageFill(dir === "in"
                    ? { format, attackerSlug: theirs.slug, attacker: theirSet, defender: ourSet,
                        ...(incoming?.move ? { move: incoming.move } : {}) }
                    : { format, attackerSlug: ours.slug, attacker: ourSet, defender: theirSet,
                        ...(cell.offense?.move ? { move: cell.offense.move } : {}) });
                  navigate("/calc?tab=damage");
                }}>{t("matchup.calculate")}</button>
          }
        />
      );
    })}</div>
  </section>;
});
