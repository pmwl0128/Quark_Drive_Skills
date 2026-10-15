/** The small shared parts of every surface that keeps run records (frontend/design.md §2.3, §7.2–7.5):
 * the elapsed clock, the note that says a result's data has since changed, relative times, a team
 * as type dots — and the strip of record cards builds and diagnoses list their runs in (each is a
 * team). The question log is the Q&A page's own (QaPage.tsx QaHistory). */
import { IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useLang } from "../../i18n.ts";
import { useRuntime } from "../../runtime/context.tsx";
import { useAssistT } from "./messages.ts";
import {
  clearRecords, deleteRecord, freshness, isCutOff, relativeTime, type AssistKind, type AssistRecord,
} from "../../lib/runRecords.ts";
import type { FormatId } from "@pokemon-champions/protocol";

/** Large read-only views load when a result is opened, without suspending its input or progress. */
export function ResultBoundary({ children }: { children: ReactNode }) {
  const t = useAssistT();
  return <Suspense fallback={<div className="spinner">{t("state.loading")}</div>}>{children}</Suspense>;
}

/** Seconds since `startedAt`, ticking. */
export function Elapsed({ startedAt }: { startedAt: number }) {
  const t = useAssistT();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return <span className="aw-elapsed num">{t("diag.progress.elapsed").replace("{seconds}", String(seconds))}</span>;
}

type RecordState = "running" | "interrupted" | "failed" | "stale" | "done";

/** How a record reads now: still running, cut off, failed, done on data since replaced, or done. */
function useRecordState(record: AssistRecord, formats: FormatId[]): RecordState {
  const { capabilities } = useRuntime();
  if (record.status === "running") return isCutOff(record) ? "interrupted" : "running";
  if (record.status === "failed") return "failed";
  return freshness(record, capabilities, formats).dataChanged ? "stale" : "done";
}

const BADGES: Partial<Record<RecordState, Parameters<ReturnType<typeof useAssistT>>[0]>> = {
  running: "rec.running", interrupted: "rec.interrupted", failed: "rec.failed", stale: "rec.stale",
};

function StateBadge({ state }: { state: RecordState }) {
  const t = useAssistT();
  const key = BADGES[state];
  return key ? <span className={`aw-rec-badge ${state}`}>{t(key)}</span> : null;
}

/** What the reader is told about a finished record's footing: data replaced since, another rule. */
export function FreshnessNote({ record, formats, action }: {
  record: AssistRecord; formats: FormatId[]; action?: ReactNode;
}) {
  const t = useAssistT();
  const { capabilities } = useRuntime();
  const { dataChanged, ruleChanged } = freshness(record, capabilities, formats);
  if (!dataChanged && !ruleChanged) return null;
  const asOf = record.snapshot.asOf ?? t("rec.unknownDate");
  return (
    <div className="aw-fresh" role="status">
      <span className="aw-fresh-dot" aria-hidden="true" />
      <span className="aw-fresh-text">
        {ruleChanged
          ? t("rec.ruleNote").replace("{season}", record.snapshot.season).replace("{rule}", record.snapshot.rule)
          : t("rec.staleNote").replace("{asOf}", asOf)}
      </span>
      {action}
    </div>
  );
}

/** Clears a kind's finished records after a second click. */
function ClearRecords({ kind }: { kind: AssistKind }) {
  const t = useAssistT();
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <span className="aw-clear">
      <button type="button" className="aw-clear-btn danger"
        onClick={() => { clearRecords(kind); setConfirming(false); }}>{t("rec.clearConfirm")}</button>
      <button type="button" className="aw-clear-btn" onClick={() => setConfirming(false)}>{t("rec.cancel")}</button>
    </span>
  ) : (
    <button type="button" className="aw-clear-btn" onClick={() => setConfirming(true)}>
      <IconTrash aria-hidden="true" />{t("rec.clear")}
    </button>
  );
}

interface StripCard {
  /** The card's picture: a team's members, a brief. */
  body: ReactNode;
  formats: FormatId[];
}

function StripEntry({ record, card, on, onSelect }: {
  record: AssistRecord; card: StripCard; on: boolean; onSelect: () => void;
}) {
  const t = useAssistT();
  const { lang } = useLang();
  const state = useRecordState(record, card.formats);
  return (
    <li className={`aw-card ${state}${on ? " on" : ""}`}>
      <button type="button" className="aw-card-pick" aria-current={on || undefined} onClick={onSelect}>
        {card.body}
        <span className="aw-card-meta">
          <span className="num">{relativeTime(record.createdAt, lang, t("rec.justNow"))}</span>
          <StateBadge state={state} />
        </span>
      </button>
      <button type="button" className="aw-card-del" aria-label={t("rec.delete")} title={t("rec.delete")}
        onClick={() => deleteRecord(record.id)}>
        <IconX aria-hidden="true" />
      </button>
    </li>
  );
}

/** Builds and diagnoses: a strip of cards, newest first, the one on screen raised. Each card is a
 * team, so the strip reads as the teams this tab has produced. */
export function RecordStrip<I>({ kind, title, records, selected, onSelect, onNew, card }: {
  kind: AssistKind;
  title: string;
  records: AssistRecord<I>[];
  selected: string | null;
  onSelect: (id: string) => void;
  onNew?: () => void;
  card: (record: AssistRecord<I>) => StripCard;
}) {
  const t = useAssistT();
  if (!records.length) return null;
  return (
    <section className="aw-strip" aria-label={title}>
      <div className="aw-strip-head">
        <h2>{title}</h2>
        <span className="aw-count num">{records.length}</span>
        <span className="aw-strip-tools">
          {onNew && (
            <button type="button" className="aw-clear-btn" onClick={onNew}>
              <IconPlus aria-hidden="true" />{t("rec.new")}
            </button>
          )}
          {records.some((r) => r.status !== "running") && <ClearRecords kind={kind} />}
        </span>
      </div>
      <ol className="aw-strip-list">
        {records.map((record) => (
          <StripEntry key={record.id} record={record} card={card(record)} on={record.id === selected}
            onSelect={() => onSelect(record.id)} />
        ))}
      </ol>
    </section>
  );
}
