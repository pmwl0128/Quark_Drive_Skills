/** Shared compact result card for every matchup table. Complete builds live in the name previews
 * and optional image export; callers supply immutable calculation coordinates and facts. */
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useMatchupT } from "../pages/matchup/messages.ts";
import { useDamageText } from "../lib/damageText.tsx";
import { BuildSetSummary, type BuildCardOption } from "./BuildPicker.tsx";
import { ExportMenu } from "./ExportMenu.tsx";
import { EntityHover } from "./EntityHover.tsx";
import { IconX } from "@tabler/icons-react";
import "../styles.matchup.css";


/** A KO verdict in the shape `damageText.ko` renders. Callers MUST prefer the engine's
 * recovery-aware verdict over static rolls: Leftovers can turn a static 2HKO into an 87.5% chance,
 * and labelling that "guaranteed" contradicts the grade, which is computed from the real number. */
interface KoVerdict {
  text?: string | null;
  n?: number | null;
  guaranteed?: boolean | null;
  chancePct?: number | null;
}

export interface InspectorDamage {
  move: string;
  minPercent: number;
  maxPercent: number;
  ko: KoVerdict;
  /** Engine caveats (multi-hit approximation, ability shifts…). */
  caveats?: string[];
}

interface InspectorSpeed {
  mine: number | null;
  theirs: number | null;
  fasterName?: string | null;
}

export interface InspectorBuild {
  /** Names the configuration in the plain-text copy and complete image export. */
  label: string;
  option: BuildCardOption | null;
  index?: number;
}

/** The name previews exactly the configuration used for this result, without the dex facts. */
export function InspectorMon({ build, children }: { build?: InspectorBuild; children: ReactNode }) {
  if (!build?.option) return <>{children}</>;
  return <EntityHover kind="spread" name="" link={false}
    previewAddon={<BuildSetSummary option={build.option} index={build.index ?? 0} />}>
    {children}
  </EntityHover>;
}

export function InspectorToolbar({ children, onClear, empty }: {
  children: ReactNode; onClear: () => void; empty: boolean;
}) {
  const t = useMatchupT();
  return <div className="matchup-result-toolbar">
    {children}
    <span className="matchup-clear-group">
      <small className="muted">{t("matchup.resultLimit")}</small>
      <button type="button" className="second-btn matchup-clear" onClick={onClear} disabled={empty}
        aria-label={t("matchup.clearDetails")} title={t("matchup.clearDetails")}>{t("matchup.clear")}</button>
    </span>
  </div>;
}

export function CellInspector({
  head, headNotes = [], grade, gradeFacts, directions = [], speed, builds, calculate, extra, onRemove, panelRef,
  className = "", loading = false,
}: {
  className?: string;
  loading?: boolean;
  onRemove: () => void;
  panelRef?: (node: HTMLDivElement | null) => void;
  head: ReactNode;
  /** Caveats for a single attack described by the heading. */
  headNotes?: string[];
  grade?: string | null;
  /** Short qualifiers shown next to the atomic grade (C0 kind, contested…). */
  gradeFacts?: ReactNode[];
  /** Both directions, in the order the caller wants them read. */
  directions?: Array<{ label: ReactNode; damage: InspectorDamage | null }>;
  speed?: InspectorSpeed | null;
  /** Same complete configuration cards used by the table-head popover. */
  builds?: InspectorBuild[];
  /** Calculator hand-off button, rendered before the copy action in the title row. */
  calculate?: ReactNode;
  extra?: ReactNode;
}) {
  const t = useMatchupT();
  const damageText = useDamageText();
  const rootRef = useRef<HTMLDivElement>(null);
  const attachRef = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    panelRef?.(node);
  }, [panelRef]);
  const [includeBuilds, setIncludeBuilds] = useState(true);
  const [exportActive, setExportActive] = useState(false);
  const exportWidth = (width: number) => includeBuilds ? Math.max(760, width) : width;
  const prepareShot = (node: HTMLElement) => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.classList.add("md-export");
    if (includeBuilds) clone.classList.add("md-export-with-builds");
    clone.style.cssText = `position:fixed;left:-10000px;top:0;width:${exportWidth(node.getBoundingClientRect().width)}px;max-width:none;margin:0;`;
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll<HTMLElement>(".md-build-cards").forEach((el) => { el.hidden = !includeBuilds; });
    document.body.append(clone);
    return { node: clone, dispose: () => clone.remove() };
  };

  const speedResult = speed?.mine != null && speed.theirs != null && speed.mine === speed.theirs
    ? t("matchup.faster.tie")
    : speed?.fasterName
      ? t("matchup.faster.named").replace("{name}", speed.fasterName)
      : null;

  /** The panel as plain text: the head, each side's build field by field, both directions, extras. */
  const plainText = (): string => {
    const root = rootRef.current;
    if (!root) return "";
    const clean = (node: Element | null) => ((node as HTMLElement | null)?.innerText || node?.textContent || "")
      .split("\n").map((line) => line.trim()).filter(Boolean).join("\n") ?? "";
    const heading = root.querySelector(".md-head-summary")?.cloneNode(true) as HTMLElement | undefined;
    heading?.querySelectorAll(".hp-warning").forEach((note) => note.remove());
    const sections = [heading?.textContent?.replace(/\s+/g, " ").trim() ?? "", ...headNotes,
      clean(root.querySelector(".md-grade-facts"))];
    root.querySelectorAll<HTMLElement>(".md-build-slot").forEach((slot) => {
      const readAll = (selector: string) => Array.from(slot.querySelectorAll(selector))
        .map((node) => clean(node)).filter(Boolean);
      const identity = readAll(".build-card-identity > span:not(.build-card-sep)");
      const tag = clean(slot.querySelector(".build-card-tag"));
      const share = clean(slot.querySelector(".build-card-share"));
      const lines = [
        [slot.dataset.copyLabel, tag, share].filter(Boolean).join(" · "),
        t("calc.item") + ": " + (clean(slot.querySelector(".build-card-primary > b")) || "—"),
        t("calc.ability") + ": " + (identity[0] ?? "—"),
        t("calc.nature") + ": " + (identity[1] ?? "—"),
        t("calc.sps") + ": " + (readAll(".build-card-sp-stat").join(" / ") || "—"),
        t("matchup.copy.moves") + ": "
          + (readAll(".build-card-move > span:last-child").join(" / ") || "—"),
        t("matchup.copy.stats") + ": " + (readAll(".build-card-stat").join(" / ") || "—"),
      ];
      sections.push(lines.join("\n"));
    });
    root.querySelectorAll<HTMLElement>(".md-directions .md-dir").forEach((dir, index) => {
      const verdict = dir.querySelector(".md-dir-result > span[title]");
      const result = clean(dir.querySelector(".md-dir-result"));
      const fullResult = verdict ? result.replace(clean(verdict), verdict.getAttribute("title") || clean(verdict)) : result;
      const body = [clean(dir.querySelector(".md-dir-label-text")), fullResult,
        ...(directions[index]?.damage?.caveats ?? [])].filter(Boolean).join("\n");
      if (body) sections.push(body);
    });
    const extraText = clean(root.querySelector(".md-extra"));
    if (extraText) sections.push(extraText);
    return sections.filter(Boolean).join("\n\n");
  };

  return (
    <div ref={attachRef} className={`panel matchup-detail result-inspector${className ? ` ${className}` : ""}`}
         aria-busy={loading || undefined} tabIndex={-1}>
      <div className="md-head">
        <div className="md-head-summary">
          <span className="md-head-pair">{head}{headNotes.length > 0 && (
            <span className="hp-warning" tabIndex={0} role="img"
              aria-label={headNotes.join("；")} data-tooltip={headNotes.join("\n")}>
              <span aria-hidden>!</span>
            </span>
          )}</span>
          {speed && (
            <span className="md-head-speed num" title={speedResult ?? undefined}>
              {t("matchup.speed")} {speed.mine ?? "—"}{" "}
              {speed.mine != null && speed.theirs != null
                ? speed.mine === speed.theirs ? "=" : speed.mine > speed.theirs ? ">" : "<"
                : t("matchup.vs")}{" "}{speed.theirs ?? "—"}
            </span>
          )}
          {grade && <span className={`grade-pill grade-${grade}`}>{grade}</span>}
        </div>
        <div className="md-head-actions">
          {calculate}
          <ExportMenu className="md-copy" text={plainText} shot={rootRef} exclude=".md-head-actions, .md-remove, .keep-mon"
            prepareShot={prepareShot} imageWidth={exportWidth} onExportActiveChange={setExportActive}
            imageOptions={<span className="md-export-mode" role="group" aria-label={t("matchup.exportBuilds")}>
              <button type="button" role="menuitemradio" aria-checked={!includeBuilds}
                onClick={() => setIncludeBuilds(false)}>{t("matchup.exportBrief")}</button>
              <button type="button" role="menuitemradio" aria-checked={includeBuilds}
                onClick={() => setIncludeBuilds(true)}>{t("matchup.exportFull")}</button>
            </span>}
            fileName={(scale) => `matchup_${new Date().toISOString().slice(0, 10)}_${scale}x.png`} />
          <button type="button" className="mini-x md-remove" onClick={onRemove}
            aria-label={t("matchup.removeDetail")} title={t("matchup.removeDetail")}>
            <IconX size={15} stroke={1.8} aria-hidden />
          </button>
        </div>
      </div>
      {!!gradeFacts?.length && <div className="md-grade-facts">
        {gradeFacts.map((fact, index) => <span className="md-head-fact" key={index}>{fact}</span>)}
      </div>}
      {exportActive && !!builds?.length && (
        <div className="md-build-cards" hidden>
          {builds.map((build, index) => (
            <div className="build-card md-build-slot" data-copy-label={build.label}
                 key={`${index}:${build.option?.key ?? build.label}`}>
              {build.option
                ? <BuildSetSummary option={build.option} index={build.index ?? index} title={build.label} />
                : <span className="md-build-missing">—</span>}
            </div>
          ))}
        </div>
      )}
      {directions.length > 0 && <div className="md-directions">
        {directions.map(({ label, damage }, di) => (
          <div key={di} className="md-dir">
            <div className="md-line md-dir-label">
              <span className="md-dir-label-text">{label}</span>
            </div>
            {damage ? (
              <div className="md-line md-dir-result">
                <span>{damageText.name(damage.move)}</span>{" "}
                <span className="num">{damage.minPercent}–{damage.maxPercent}%</span>{" "}
                <span title={damageText.ko(damage.ko as never)}>
                  {damageText.ko((damage.ko.n != null ? { ...damage.ko, text: null } : damage.ko) as never)}
                </span>
              </div>
            ) : <div className="md-line md-dir-result md-caveat">{loading ? t("state.loading") : "—"}</div>}
            {!!damage?.caveats?.length && <span className="hp-warning" tabIndex={0} role="img"
              aria-label={damage.caveats.join("；")} data-tooltip={damage.caveats.join("\n")}>
              <span aria-hidden>!</span>
            </span>}
          </div>
        ))}
      </div>}
      {extra && (
        <div className="md-extra">
          {extra}
        </div>
      )}
    </div>
  );
}
