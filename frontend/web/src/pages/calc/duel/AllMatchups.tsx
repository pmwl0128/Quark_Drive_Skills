/** Every attacker×move against every defender on the page, in one grid.
 *
 * The duel above answers one question at a time; this answers "what does anything on my side do to
 * anything on theirs", which is the question a build session actually has. Columns are grouped under
 * the attacking mon's portrait so a column reads as "this mon, this move", and the axis flips rather
 * than being duplicated — the same two teams, asked the other way round. */
import type { DamageResultDto } from "@pokemon-champions/protocol";
import { isErrorShape } from "@pokemon-champions/protocol";
import { BuildSetSummary, setMember, type BuildCardOption } from "../../../components/BuildPicker.tsx";
import { CellInspector, InspectorMon, type InspectorBuild } from "../../../components/CellInspector.tsx";
import { DragMon } from "../../../components/library/DragMon.tsx";
import { toTeamMember } from "../../../lib/teamDoc.ts";
import { EntityHover } from "../../../components/EntityHover.tsx";
import { GameImage } from "../../../components/GameImage.tsx";
import { displayName, useLang } from "../../../i18n.ts";
import { useCalcT } from "../messages.ts";
import { useDamageText } from "../../../lib/damageText.tsx";
import { useCellHistory } from "../../../lib/useCellHistory.ts";
import { koLabel, koTone } from "../../../lib/ko.ts";
import type { DexIndexEntry } from "../../../runtime/adapter.ts";

export interface GridCol {
  attackerIndex: number;
  entry: DexIndexEntry;
  /** Immutable snapshot of the exact build used by this calculation run. */
  build: BuildCardOption;
  move: string;
  /** Plain localized name. Type and category badges are deliberately absent: a header row of a
   * dozen columns has to stay narrow, and the grid is read for its numbers, not its taxonomy. */
  label: string;
}

export interface GridRow {
  entry: DexIndexEntry;
  /** Immutable snapshot of the exact build used by this calculation run. */
  build: BuildCardOption;
}

/** The exact build a header was computed with, as a library member (Mega form and stone normalized). */
const buildMember = (build: BuildCardOption) => () => toTeamMember(setMember(build.set));
const cellKey = ({ r, c }: { r: number; c: number }) => `${r}:${c}`;

function GridDetail({ row, col, result, onRemove, panelRef }: {
  row: GridRow; col: GridCol; result: DamageResultDto;
  onRemove: () => void; panelRef?: (node: HTMLDivElement | null) => void;
}) {
  const { lang } = useLang();
  const t = useCalcT();
  const damageText = useDamageText();
  const attacker: InspectorBuild = { label: displayName(col.entry, lang), option: col.build };
  const defender: InspectorBuild = { label: displayName(row.entry, lang), option: row.build };
  const monName = (build: InspectorBuild, entry: DexIndexEntry) => (
    <InspectorMon build={build}>
      <span className="prose-mon">
        <GameImage assetKey={entry.key} role="dense" alt="" className="prose-mon-img" />{build.label}
      </span>
    </InspectorMon>
  );
  const names = {
    "{attacker}": monName(attacker, col.entry),
    "{defender}": monName(defender, row.entry),
    "{move}": damageText.name(result.move),
  };
  const summary = t("calc.damageLine").split(/(\{(?:attacker|move|defender)\})/g).filter(Boolean).map((part, i) =>
    <span key={i}>{part in names ? names[part as keyof typeof names] : part}</span>);
  const rolls = `${t("calc.rolls")}: ${result.damage.join(", ")} / HP ${result.defenderHP}`;
  return <CellInspector className="calc-grid-detail" head={summary}
    headNotes={(result.koCaveats ?? []).map(damageText.caveat)}
    builds={[attacker, defender]} onRemove={onRemove} panelRef={panelRef}
    extra={<div className="calc-grid-reading">
      <strong className="num">{result.minPercent.toFixed(1)}–{result.maxPercent.toFixed(1)}%</strong>
      {result.koChance && <span className="calc-grid-verdict">{damageText.ko(result.koChance)}</span>}
      <span className="calc-grid-rolls num duel-tip" tabIndex={0} aria-label={rolls} data-tooltip={rolls}>
        <span className="calc-grid-roll-values">{rolls}</span>
      </span>
    </div>} />;
}

export function AllMatchups({
  rows, cols, results, onRun, runnable, stale, busy, error, fromLabel, toLabel,
}: {
  /** The axes the CURRENT results were computed against — never the live plan, or a stale grid
   * would be painted onto axes its cells do not belong to. */
  rows: GridRow[];
  cols: GridCol[];
  /** Row-major, aligned to rows × cols; a cell is a result, an engine error, or null (not run). */
  results: Array<DamageResultDto | { error?: unknown } | null>;
  onRun: () => void;
  /** There is something to compute right now (both sides populated, within the batch bound). */
  runnable: boolean;
  /** The inputs moved since these results were produced. */
  stale: boolean;
  busy: boolean;
  error: string | null;
  fromLabel: string;
  toLabel: string;
}) {
  const { lang } = useLang();
  const t = useCalcT();
  // A fresh calculation replaces its axes and results together; old coordinates must not be
  // reinterpreted as another hit. Edits marked stale keep the last run and its cards intact.
  const history = useCellHistory(results, cellKey);
  const cell = history.selected;

  // Column groups: consecutive runs of the same attacker, so its portrait spans its own moves.
  const groups: Array<{ index: number; entry: DexIndexEntry; build: BuildCardOption; span: number }> = [];
  for (const col of cols) {
    const last = groups[groups.length - 1];
    if (last && last.index === col.attackerIndex) last.span += 1;
    else groups.push({ index: col.attackerIndex, entry: col.entry, build: col.build, span: 1 });
  }

  return (
    <section className="panel all-matchups">
      {/* The rule belongs to the whole header, not to the title alone: the hint and the compute
          control are part of the same band, so they sit above the line rather than beside a short one. */}
      <header className="all-matchups-head">
        <h2>{t("calc.allMatchups")}</h2>
        <p className="muted">{t("calc.allMatchupsHint")}</p>
        <span className="all-matchups-actions">
          {stale && <span className="grid-stale">{t("calc.gridStale")}</span>}
          <button type="button" className={stale || !results.length ? "primary-btn" : "ghost-btn"}
            onClick={onRun} disabled={busy || !runnable}>
            {busy ? t("state.loading")
              : results.length ? t("calc.gridRefresh") : t("calc.gridCompute")}
          </button>
          <button type="button" className="ghost-btn" onClick={history.clear} disabled={!history.entries.length}
            aria-label={t("calc.gridClearDetails")} title={t("calc.gridClearDetails")}>{t("calc.gridClear")}</button>
        </span>
      </header>

      {error && <div className="notice mono">{error}</div>}

      {/* Nothing has been computed yet: the button above already says what to do, so an
          explanation of the button would only be text to scroll past. */}
      {!error && !runnable && (cols.length === 0 || rows.length === 0) && (
        <div className="notice">{t("calc.allMatchupsEmpty")}</div>
      )}

      {!error && cols.length > 0 && rows.length > 0 && (
        <div className="matrix-scroll">
          <table className={`calc-matrix all-grid${busy || stale ? " busy" : ""}`}>
            <thead>
              <tr>
                <th className="corner" rowSpan={2}>{toLabel} \ {fromLabel}</th>
                {groups.map((g, gi) => (
                  <th key={`${g.index}-${gi}`} colSpan={g.span} className="grid-attacker">
                    <EntityHover kind="spread" name="" link={false}
                      previewAddon={<BuildSetSummary option={g.build} index={0} />}>
                      <DragMon className="p-inner" member={buildMember(g.build)} name={displayName(g.entry, lang)}>
                        <GameImage assetKey={g.entry.key} role="dense"
                          alt={displayName(g.entry, lang)} className="mini" />
                        <span className="nm">{displayName(g.entry, lang)}</span>
                      </DragMon>
                    </EntityHover>
                  </th>
                ))}
              </tr>
              <tr>
                {cols.map((c, ci) => (
                  <th key={ci} className="grid-move">
                    <EntityHover kind="move" name={c.move} link={false}>
                      <span className="col-move">{c.label}</span>
                    </EntityHover>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  <th className="row-mon">
                    <EntityHover kind="spread" name="" link={false}
                      previewAddon={<BuildSetSummary option={row.build} index={0} />}>
                      <DragMon className="p-inner" member={buildMember(row.build)} name={displayName(row.entry, lang)}>
                        <GameImage assetKey={row.entry.key} role="dense"
                          alt={displayName(row.entry, lang)} className="mini" />
                        <span className="nm">{displayName(row.entry, lang)}</span>
                      </DragMon>
                    </EntityHover>
                  </th>
                  {cols.map((_, ci) => {
                    const res = results[ri * cols.length + ci];
                    if (!res || isErrorShape(res)) {
                      return <td key={ci} className="ko-none miss">—</td>;
                    }
                    const dto = res as DamageResultDto;
                    const turns = dto.koChance?.n
                      ?? (dto.maxPercent > 0
                        ? Math.ceil(100 / Math.max(dto.maxPercent, 0.01)) : null);
                    const tone = koTone(turns, dto.koChance?.guaranteed ?? false, dto.max);
                    const on = cell?.r === ri && cell?.c === ci;
                    return (
                      <td key={ci} className={`ko-${tone}${on ? " on" : ""}`}
                        role="button" tabIndex={0} aria-pressed={on}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault(); history.append({ r: ri, c: ci });
                          }
                        }}
                        onClick={() => history.append({ r: ri, c: ci })}>
                        <span className="pct num">{dto.maxPercent.toFixed(1)}%</span>
                        <span className="ko num">
                          {koLabel(turns, dto.max > 0, dto.koChance?.guaranteed ?? false, lang)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="matchup-details calc-grid-details">
        {history.entries.map(({ id, value: { r, c } }) => {
          const result = results[r * cols.length + c];
          if (!result || isErrorShape(result) || !rows[r] || !cols[c]) return null;
          return <GridDetail key={id} row={rows[r]} col={cols[c]} result={result as DamageResultDto}
            onRemove={() => history.remove(id)} panelRef={history.activeId === id ? history.panelRef : undefined} />;
        })}
      </div>
    </section>
  );
}
