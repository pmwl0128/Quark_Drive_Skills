/** Team diagnose tab (team.validate, design §7.5): free-form team text (Showdown export or
 * team-json) -> parse -> validate + diagnose report, with an optional AI reading. Lives on the
 * assist page and accepts a team handed over from a saved team or the wizard result ("diagnose
 * this team"). Report facts render with dex-localized species chips. Each diagnosis is kept as a
 * run record (lib/runRecords.ts) with the data it was made against, listed as a strip of team cards;
 * while one runs, its steps and the submitted team show on the build's assembly layout. */
import "../styles.assist.css";
import type { DiagnoseReportDto, FormatId } from "@pokemon-champions/protocol";
import { DIAGNOSE_TEXT_MAX_CHARS, DiagnoseReportDtoSchema } from "@pokemon-champions/protocol";
import { lazy, useEffect, useMemo, useState, type CSSProperties } from "react";
import { IconCheck, IconChevronUp, IconFileText, IconPencil, IconRefresh, IconShieldCheck, IconSparkles, IconSwords } from "@tabler/icons-react";
import { FormatTabs } from "../components/FormatTabs.tsx";
import { ThinkingToggle } from "../components/ThinkingToggle.tsx";
import { useLang } from "../i18n.ts";
import { useAssistT } from "./assist/messages.ts";
import { readTeamMembers } from "../lib/team.ts";
import { HttpError } from "../runtime/adapter.ts";
import { useRuntime } from "../runtime/context.tsx";
import { useTransferT } from "../lib/library/transferMessages.ts";
import { useLibraryDrop, useLibraryReceiver, useLibrarySource } from "../lib/library/workspace.tsx";
import { toTeamDoc } from "../lib/teamDoc.ts";
import { isDiagnoseTextFill } from "../lib/diagnoseHandoff.ts";
import { deleteRecord, finishRecord, isCutOff, readResult, readSelected, saveSelected, snapshotOf, startRecord, updateRecord, useAssistRecords, type AssistRecord } from "../lib/runRecords.ts";
import { Elapsed, FreshnessNote, RecordStrip, ResultBoundary } from "./assist/Workspace.tsx";
import { BenchMon } from "./assist/BuildAssembly.tsx";
import { TeamSprites } from "../components/TeamDots.tsx";
import { readSheet } from "./home/teamSheet.ts";

const Report = lazy(() => import("./assist/diagnose/Report.tsx").then(module => ({ default: module.Report })));

type ErrorKind = "limit" | "unparseable" | "generic";

function errorKind(e: unknown): ErrorKind {
  if (!(e instanceof HttpError)) return "generic";
  if (e.status === 429) return "limit";
  if (e.code === "unparseable") return "unparseable";
  return "generic";
}

/** A diagnosis as it was asked for: the team text, its format and the reading options. */
interface DiagnoseInput {
  format: FormatId;
  text: string;
  explain: boolean;
  thinking: boolean;
}

/** The form as the reader left it (sessionStorage): a draft for this browser session, not a record. */
const DRAFT_KEY = "pc-diagnose-draft";
function readDraft(): Partial<DiagnoseInput> {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "{}") as Partial<DiagnoseInput>;
  } catch {
    return {};
  }
}
function writeDraft(draft: Pick<DiagnoseInput, "format" | "text">): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch { /* storage blocked */ }
}

/** A record's report, read back through the schema: a report from an older build can lack fields this
 * build reads unconditionally, and safeParse fills defaults for a compatible one and drops the rest. */
function reportOf(record: AssistRecord<DiagnoseInput>): DiagnoseReportDto | null {
  return readResult(record, DiagnoseReportDtoSchema);
}

/** The diagnosis in flight, held OUTSIDE React: switching tabs unmounts this one, and the server
 * keeps no diagnose job to come back to. Module scope keeps the promise; the record it fills does
 * the rest. */
let activeDiagnosis: { id: string; promise: Promise<DiagnoseReportDto> } | null = null;

/** When each deterministic step reads as done (ms after the start): the server reports none of them,
 * so the steps advance on a plausible clock and all complete the moment the report arrives. */
const STEP_AT = [1500, 4000];

/** A diagnosis at work, on the build's assembly layout: the steps on the left, the submitted team on
 * the bench. */
function DiagnoseRun({ record, reportReady }: { record: AssistRecord<DiagnoseInput>; reportReady: boolean }) {
  const t = useAssistT();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  const input = record.input;
  const sheet = useMemo(() => readSheet(input.text), [input.text]);
  const members = sheet?.known ? sheet.mons.map((m) => m.species) : [];
  const took = now - record.createdAt;
  const steps = [
    { id: "parse", Icon: IconFileText, label: t("diag.progress.parse") },
    { id: "structure", Icon: IconShieldCheck, label: t("diag.progress.structure") },
    { id: "checks", Icon: IconSwords, label: t("diag.progress.checks") },
    ...(input.explain ? [{ id: "explain", Icon: IconSparkles,
      label: t(input.thinking ? "diag.progress.explainThinking" : "diag.progress.explain") }] : []),
  ];
  const status = (i: number): "done" | "running" | "pending" => {
    if (reportReady) return i < 3 ? "done" : "running";
    if (i < 2) return took >= STEP_AT[i]! ? "done" : (i === 0 || took >= STEP_AT[i - 1]!) ? "running" : "pending";
    if (i === 2) return took >= STEP_AT[1]! ? "running" : "pending";
    return "pending";
  };
  const done = steps.filter((_, i) => status(i) === "done").length;
  const at = steps.findIndex((_, i) => status(i) === "running");
  return (
    <section id="diag-progress" className="ar-run diag-run" aria-live="polite">
      <header className="ar-run-head">
        <span className="ar-run-core" aria-hidden="true" />
        <h2>{t(reportReady ? "diag.progress.explaining" : "diag.run.title")}</h2>
      </header>
      <div className="asm live" style={{ "--progress": (done + (at >= 0 ? 0.5 : 0)) / steps.length } as CSSProperties}>
        <div className="asm-bar" aria-hidden="true"><i /></div>
        <div className="asm-meta">
          <span className="num">{t("asm.step").replace("{n}", String(at >= 0 ? at + 1 : done)).replace("{total}", String(steps.length))}</span>
          <Elapsed startedAt={record.createdAt} />
        </div>
        <div className="asm-body">
          <ol className="asm-steps">
            {steps.map((step, i) => {
              const s = status(i);
              return (
                <li key={step.id} className={`asm-step ${s}`}>
                  <span className="asm-node" aria-hidden="true">{s === "done" ? <IconCheck /> : <step.Icon />}</span>
                  <div className="asm-step-text">
                    <div className="asm-step-name"><b className="num">{String(i + 1).padStart(2, "0")}</b><span>{step.label}</span></div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="asm-bench">
            <div className="asm-block">
              <span className="asm-label">{t("diag.progress.preview")}</span>
              <span className="asm-brief">
                <span>{t(`format.${input.format}`)}</span>
                {members.length > 0 && <span>{t("diag.brief.members").replace("{n}", String(members.length))}</span>}
                {input.explain && <span>{t("diag.explain")}</span>}
              </span>
            </div>
            <div className="asm-block asm-team">
              <ol className="asm-slots">
                {Array.from({ length: 6 }, (_, i) => {
                  const name = members[i];
                  return (
                    <li key={i} className={name ? "filled" : ""} style={{ "--n": i } as CSSProperties}>
                      {name ? <BenchMon name={name} /> : <span className="asm-slot-num num">{i + 1}</span>}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The brief of the diagnosis on screen, folded to one line while its report is read. */
function DiagnoseBrief({ record, report, onEdit, onRerun, busy }: {
  record: AssistRecord<DiagnoseInput>; report: DiagnoseReportDto | null; onEdit: () => void; onRerun: () => void; busy: boolean;
}) {
  const t = useAssistT();
  const members = report ? readTeamMembers(report.team).map((m) => m.species) : [];
  return (
    <div className="aw-brief">
      <span className="aw-brief-facts">
        <span className="aw-brief-fact">{t(`format.${record.input.format}`)}</span>
        {members.length > 0 && <TeamSprites species={members} />}
        {record.input.explain && <span className="aw-brief-fact">{t("diag.explain")}</span>}
      </span>
      <span className="aw-brief-actions">
        <button type="button" className="ar-tool" onClick={onEdit}>
          <IconPencil aria-hidden="true" />{t("diag.brief.edit")}
        </button>
        <button type="button" className="ar-tool" disabled={busy} onClick={onRerun}>
          <IconRefresh aria-hidden="true" />{t("diag.rerun")}
        </button>
      </span>
    </div>
  );
}

export function DiagnoseTab({ active, fill, onConsumeFill }: {
  active: boolean;
  /** A team-json handed over from a saved team or the wizard result ("diagnose this team"). */
  fill: unknown | null;
  onConsumeFill: () => void;
}) {
  const { adapter, capabilities } = useRuntime();
  const t = useAssistT();
  const { lang } = useLang();
  const draft = useMemo(readDraft, []);
  const [format, setFormat] = useState<FormatId>(draft.format ?? "single");
  const [text, setText] = useState(draft.text ?? "");
  const [explain, setExplain] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [handoffReady, setHandoffReady] = useState(false);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [running, setRunning] = useState(() => activeDiagnosis !== null);
  const [error, setError] = useState<ErrorKind | null>(null);
  useEffect(() => writeDraft({ format, text }), [format, text]);

  const { records, ready } = useAssistRecords<DiagnoseInput>("diagnose");
  const [selected, setSelected] = useState<string | null>(readSelected("diagnose"));
  const current = records.find((r) => r.id === selected) ?? records[0] ?? null;
  const select = (id: string | null) => { setSelected(id); saveSelected("diagnose", id); };
  const [composing, setComposing] = useState<boolean | null>(null);
  const open = composing ?? (ready && !current);
  const report = current ? reportOf(current) : null;

  useEffect(() => {
    if (!active) return;
    let live = true;
    adapter.quota?.().then((all) => { if (live) setQuota(all.diagnose); }, () => {});
    return () => { live = false; };
  }, [adapter, active]);

  const thinkingUnavailable = quota === null || (quota.limit > 0 && quota.limit - quota.used < 2);
  useEffect(() => {
    if (thinkingUnavailable) setThinking(false);
  }, [thinkingUnavailable]);

  // Re-attach to a diagnosis still in flight from an earlier mount of this tab.
  useEffect(() => {
    const task = activeDiagnosis;
    if (!task) return;
    let live = true;
    setRunning(true);
    task.promise.then((next) => { if (live) setQuota(next.quota); },
      (reason: unknown) => { if (live) setError(errorKind(reason)); })
      .finally(() => { if (live) setRunning(false); });
    return () => { live = false; };
  }, []);

  const run = async (input?: DiagnoseInput) => {
    const req: DiagnoseInput = input ?? { format, text: text.trim(), explain, thinking: explain && thinking };
    if (!req.text || running || activeDiagnosis || !adapter.diagnose) return;
    setRunning(true);
    setHandoffReady(false);
    setError(null);
    const record = startRecord<DiagnoseInput>("diagnose", req, lang, snapshotOf(capabilities));
    select(record.id);
    setComposing(false);
    const promise = adapter.diagnose({
      format: req.format,
      text: req.text.slice(0, DIAGNOSE_TEXT_MAX_CHARS),
      ...(req.explain ? { explain: true, thinking: req.thinking && !thinkingUnavailable, lang } : {}),
    }, (partial) => {
      // A reading streams the finished deterministic report first: show it while the model writes.
      updateRecord(record.id, { result: partial });
      setQuota(partial.quota);
    });
    activeDiagnosis = { id: record.id, promise };
    try {
      const next = await promise;
      finishRecord(record.id, next);
      setQuota(next.quota);
    } catch (e) {
      // A refused or failed diagnosis leaves no record; the team text is still in the form.
      deleteRecord(record.id);
      setError(errorKind(e));
      setComposing(true);
    } finally {
      activeDiagnosis = null;
      setRunning(false);
    }
  };

  // A hand-off only fills the editable form. The visitor may change sets, format,
  // AI-reading mode, or thinking mode before consciously spending a diagnosis allowance.
  const takeTeam = (team: unknown) => {
    if (isDiagnoseTextFill(team)) {
      setText(team.text);
      if (team.format === "single" || team.format === "double") setFormat(team.format);
    } else {
      setFormat((team as { format?: string }).format === "double" ? "double" : "single");
      setText(JSON.stringify(team, null, 1));
    }
    setError(null);
    setHandoffReady(true);
    setComposing(true);
    requestAnimationFrame(() => document.getElementById("diag-text")?.focus());
  };
  useEffect(() => {
    if (fill === null) return;
    takeTeam(fill);
    onConsumeFill();
  }, [fill]);

  // The library workspace (design §2.4), while this tab is the one on screen: a saved team goes
  // into the form, and the team a report was made for can be kept.
  const bt = useTransferT();
  useLibraryReceiver(active ? { id: "diagnose-team", kind: "team", label: bt("transfer.diagnose.team"),
    receive: ({ doc }) => { takeTeam(doc); return { ok: true }; } } : null);
  useLibrarySource(active && report && current ? { id: "diagnose-keep", origin: "diagnose", kind: "team",
    label: bt("transfer.diagnose.save"), read: () => toTeamDoc(report.team, current.input.format) } : null);
  const drop = useLibraryDrop(["diagnose-team"]);

  const edit = (record: AssistRecord<DiagnoseInput>) => {
    setFormat(record.input.format);
    setText(record.input.text);
    setExplain(record.input.explain);
    setThinking(record.input.thinking && !thinkingUnavailable);
    setComposing(true);
  };

  const view = (() => {
    if (!current || open) return null;
    const live = activeDiagnosis?.id === current.id;
    if (current.status === "running" && live) {
      return (
        <>
          <DiagnoseRun record={current} reportReady={report !== null} />
          {report && <ResultBoundary><Report report={report} /></ResultBoundary>}
        </>
      );
    }
    if (current.status === "running") {
      return (
        <article className="ar-card muted-card">
          <p className="ar-card-note">{t(isCutOff(current) ? "rec.interruptedNote" : "diag.run.elsewhere")}</p>
          <div className="ar-card-actions">
            <button type="button" className="primary-btn" onClick={() => void run(current.input)}>{t("diag.rerun")}</button>
          </div>
        </article>
      );
    }
    if (!report) {
      return (
        <article className="ar-card muted-card">
          <p className="ar-card-note">{t("rec.unreadable")}</p>
          <div className="ar-card-actions">
            <button type="button" className="primary-btn" onClick={() => void run(current.input)}>{t("diag.rerun")}</button>
          </div>
        </article>
      );
    }
    return (
      <>
        <FreshnessNote record={current} formats={[current.input.format]} action={
          <button type="button" className="aw-fresh-act" onClick={() => void run(current.input)}>{t("diag.rerun")}</button>} />
        <ResultBoundary><Report report={report} /></ResultBoundary>
      </>
    );
  })();

  return (
    <div className="assist-surface aw">
      <p className="notice page-disclosure">{t("diag.disclosure")}</p>
      <RecordStrip kind="diagnose" title={t("rec.diagTitle")} records={records}
        selected={open ? null : current?.id ?? null}
        onSelect={(id) => { select(id); setComposing(false); }}
        onNew={() => { setComposing(true); setError(null); }}
        card={(record) => {
          const done = reportOf(record);
          const members = done ? readTeamMembers(done.team).map((m) => m.species)
            : (() => { const sheet = readSheet(record.input.text); return sheet?.known ? sheet.mons.map((m) => m.species) : []; })();
          const rows = done?.checks?.byOpponent ?? [];
          const answered = rows.filter((row) => row.observedFloor === "C2" || row.observedFloor === "C1").length;
          const legal = done?.legality.status;
          return {
            formats: [record.input.format],
            body: (
              <>
                <TeamSprites species={members} />
                <span className="aw-card-title">
                  {legal ? (legal === "valid" ? `✓ ${t("diag.legality.valid")}` : legal === "unknown"
                    ? t("diag.legality.unknown") : `✗ ${t("diag.legality.invalid")}`)
                    : members.length ? t("diag.brief.members").replace("{n}", String(members.length)) : "—"}
                </span>
                <span className="aw-card-sub num">
                  {t(`format.${record.input.format}`)}{rows.length ? ` · ${t("diag.sum.checks")} ${answered}/${rows.length}` : ""}
                </span>
              </>
            ),
          };
        }} />

      {!open && current && (
        <DiagnoseBrief record={current} report={report} busy={running}
          onEdit={() => edit(current)} onRerun={() => void run(current.input)} />
      )}

      {open && (
        <div className="aw-composer form-panel builder-form">
          <div className="builder-field">
            <label>{t("format.single")} / {t("format.double")}</label>
            <FormatTabs format={format} onChange={setFormat} />
          </div>
          <div className="builder-field" {...drop}>
            <label htmlFor="diag-text">{t("diag.text")}</label>
            <textarea id="diag-text" rows={8} value={text}
                      maxLength={DIAGNOSE_TEXT_MAX_CHARS}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={t("diag.placeholder")} />
            {handoffReady && <p className="notice diag-prefilled">{t("diag.prefilled")}</p>}
          </div>
          <div className="diag-mode-options">
            <label className="diag-explain-opt">
              <input type="checkbox" checked={explain}
                     onChange={(e) => {
                       setExplain(e.target.checked);
                       if (!e.target.checked) setThinking(false);
                     }} />
              {t("diag.explain")}
            </label>
          </div>
          {/* The submit cluster mirrors the wizard's: thinking mode over the quota and the primary
            * button. */}
          <div className="assist-submit">
            <ThinkingToggle checked={thinking} onChange={(checked) => {
              setThinking(checked);
              if (checked) setExplain(true);
            }}
              disabled={running || thinkingUnavailable} label={t("thinking.label")}
              tip={`${t("diag.thinkingTip")}${quota !== null && quota.limit > 0
                && quota.limit - quota.used < 2 ? ` ${t("thinking.insufficient")}` : ""}`} />
            <div className="builder-actions">
              {current && (
                <button type="button" className="ar-tool" onClick={() => setComposing(false)}>
                  <IconChevronUp aria-hidden="true" />{t("builder.brief.collapse")}
                </button>
              )}
              <span className={`aw-quota num${quota ? "" : " pending"}`}>
                {t("diag.quota")} {!quota ? "—" : quota.limit === 0
                  ? t("quota.unlimited") : `${quota.used}/${quota.limit}`}
              </span>
              <button type="button" className="primary-btn"
                      disabled={running || !text.trim() || !!(quota && quota.limit > 0 && quota.used >= quota.limit)}
                      onClick={() => void run()}>
                {running ? t("diag.running") : t("diag.run")}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="notice qa-error">{t(`diag.error.${error}`)}</p>}
      {view}
    </div>
  );
}
