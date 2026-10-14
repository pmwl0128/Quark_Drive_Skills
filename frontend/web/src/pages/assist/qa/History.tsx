/** Searchable question history and its preview; the composer owns submitting new requests. */
import { QaAnswerDtoSchema, type QaToolTraceEntry } from "@pokemon-champions/protocol";
import { IconCornerDownLeft, IconHistory, IconMessageQuestion, IconRefresh, IconSearch, IconTrash, IconX } from "@tabler/icons-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEscapeLayer } from "../../../components/EscapeLayers.tsx";
import { useLang } from "../../../i18n.ts";
import { useProseRenderer } from "../../../lib/prose.tsx";
import { clockTime, clearRecords, deleteRecord, freshness, isCutOff, readResult, relativeTime, type AssistRecord } from "../../../lib/runRecords.ts";
import { useRuntime } from "../../../runtime/context.tsx";
import { useAssistT } from "../messages.ts";
import { toolIcon, traceFormats, useTraceLabel, type QaInput } from "./model.ts";

type Day = "today" | "yesterday" | "week" | "older";
function dayOf(ms: number): Day {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = start.getTime();
  if (ms >= today) return "today";
  if (ms >= today - 86_400_000) return "yesterday";
  if (ms >= today - 7 * 86_400_000) return "week";
  return "older";
}
const DAYS: Day[] = ["today", "yesterday", "week", "older"];

/** The kinds of data an answer read, as icons (one per kind, in first-use order). */
function TraceIcons({ trace }: { trace: QaToolTraceEntry[] }) {
  const icons = [...new Set(trace.map((entry) => toolIcon(entry.tool)))].slice(0, 4);
  return <span className="qh-icons" aria-hidden="true">{icons.map((Icon, i) => <Icon key={i} />)}</span>;
}

/** The question log: a button in the composer, and over the page when asked for, a panel with the
 * records on the left — by day, searchable, walked with the arrow keys — and the one under the
 * cursor read out on the right. Enter (or 打开) puts it on the page. Nothing of it takes room until
 * it is opened. */
export function QaHistory({ records, selected, onOpen, onAgain }: {
  records: AssistRecord<QaInput>[];
  selected: string | null;
  onOpen: (id: string) => void;
  onAgain: (question: string) => void;
}) {
  const t = useAssistT();
  const { lang } = useLang();
  const { capabilities } = useRuntime();
  const label = useTraceLabel();
  const [open, setOpen] = useState(false);
  const prose = useProseRenderer(undefined, open);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEscapeLayer(open, close, 40);
  useEffect(() => {
    if (!open) return;
    setCursor(selected ?? records[0]?.id ?? null);
    search.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [open]);

  const entries = useMemo(() => open ? records.map((record) => {
    const answer = readResult(record, QaAnswerDtoSchema);
    return { record, answer, searchText: `${record.input.question}\n${answer?.answer ?? ""}`.toLowerCase() };
  }) : [], [records, open]);
  const needle = useDeferredValue(query.trim().toLowerCase());
  const shown = needle
    ? entries.filter(entry => entry.searchText.includes(needle))
    : entries;
  const ordered = DAYS.flatMap((day) => shown.filter(({ record }) => dayOf(record.createdAt) === day));
  const active = ordered.find(({ record }) => record.id === cursor) ?? ordered[0] ?? null;

  const move = (step: number) => {
    if (!ordered.length) return;
    const at = Math.max(0, ordered.findIndex(({ record }) => record.id === active?.record.id));
    const next = ordered[Math.min(ordered.length - 1, Math.max(0, at + step))]!;
    setCursor(next.record.id);
    list.current?.querySelector<HTMLElement>(`[data-id="${next.record.id}"]`)?.scrollIntoView({ block: "nearest" });
  };
  const pick = (id: string) => { onOpen(id); setOpen(false); };

  const time = (ms: number) => {
    const day = dayOf(ms);
    return day === "today" || day === "yesterday"
      ? clockTime(ms, lang)
      : relativeTime(ms, lang, t("rec.justNow"));
  };

  return (
    <>
      <button ref={trigger} type="button" className={`qh-trigger${open ? " on" : ""}`} aria-haspopup="dialog"
        aria-expanded={open} onClick={() => setOpen(true)}>
        <IconHistory aria-hidden="true" />{t("rec.title")}
        <span className="qh-count num">{records.length}</span>
      </button>
      {open && createPortal(
        <div className="qh-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="qh" role="dialog" aria-modal="true" aria-label={t("rec.qaTitle")}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
              else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
              else if (e.key === "Enter" && active && !e.nativeEvent.isComposing
                && !(e.target as HTMLElement).closest("button")) { e.preventDefault(); pick(active.record.id); }
            }}>
            <div className="qh-head">
              <IconSearch aria-hidden="true" />
              <input ref={search} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder={t("rec.search")} aria-label={t("rec.search")} />
              <span className="qh-count num">{shown.length}</span>
              <button type="button" className="qh-close" onClick={close} aria-label={t("rec.close")}>
                <kbd>Esc</kbd><IconX className="qh-close-x" aria-hidden="true" />
              </button>
            </div>
            <div className="qh-body">
              <div className="qh-list-wrap">
                {records.length === 0 && (
                  <div className="qh-empty"><IconHistory aria-hidden="true" /><span>{t("rec.empty")}</span></div>
                )}
                {records.length > 0 && !shown.length && (
                  <div className="qh-empty"><IconSearch aria-hidden="true" /><span>{t("rec.noMatch")}</span></div>
                )}
                <ol ref={list} className="qh-list">
                  {DAYS.map((day) => {
                    const group = shown.filter(({ record }) => dayOf(record.createdAt) === day);
                    if (!group.length) return null;
                    return (
                      <li key={day} className="qh-day">
                        <span className="qh-day-label">{t(`rec.day.${day}`)}</span>
                        <ol>
                          {group.map(({ record, answer }) => {
                            const stale = answer && freshness(record, capabilities, traceFormats(answer.toolTrace)).dataChanged;
                            const on = record.id === active?.record.id;
                            return (
                              <li key={record.id}>
                                <button type="button" data-id={record.id}
                                  className={`qh-item${on ? " on" : ""}${record.id === selected ? " current" : ""}`}
                                  onMouseEnter={() => setCursor(record.id)} onFocus={() => setCursor(record.id)}
                                  onClick={() => pick(record.id)}>
                                  <span className="qh-q">{record.input.question}</span>
                                  <span className="qh-meta">
                                    <span className="num">{time(record.createdAt)}</span>
                                    {answer && <TraceIcons trace={answer.toolTrace} />}
                                    {record.status === "running" && <span className="aw-rec-badge running">{t(isCutOff(record) ? "rec.interrupted" : "rec.running")}</span>}
                                    {stale && <span className="aw-rec-badge stale">{t("rec.stale")}</span>}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className="qh-preview" aria-live="polite">
                {active ? (
                  <article key={active.record.id} className="qh-read">
                    <span className="qh-read-time num">{relativeTime(active.record.createdAt, lang, t("rec.justNow"))}</span>
                    <h3>{active.record.input.question}</h3>
                    <div className="qh-read-answer">
                      {active.answer
                        ? active.answer.answer.split(/\n+/).map((para, i) => <p key={i}>{prose(para)}</p>)
                        : <p className="muted">{t(active.record.status === "running" ? "qa.run.title" : "rec.unreadable")}</p>}
                    </div>
                    {active.answer && active.answer.toolTrace.length > 0 && (
                      <ul className="qa-source-list qh-sources">
                        {active.answer.toolTrace.map((entry, i) => {
                          const Icon = toolIcon(entry.tool);
                          return <li key={i} className="qa-source"><Icon aria-hidden="true" />{prose(label(entry))}</li>;
                        })}
                      </ul>
                    )}
                    <div className="qh-read-actions">
                      <button type="button" className="primary-btn" onClick={() => pick(active.record.id)}>
                        {t("rec.open")}<IconCornerDownLeft aria-hidden="true" />
                      </button>
                      <button type="button" className="ar-tool"
                        onClick={() => { setOpen(false); onAgain(active.record.input.question); }}>
                        <IconRefresh aria-hidden="true" />{t("qa.again")}
                      </button>
                      <button type="button" className="ar-tool qh-del" onClick={() => {
                        const at = ordered.findIndex(({ record }) => record.id === active.record.id);
                        setCursor(ordered[at + 1]?.record.id ?? ordered[at - 1]?.record.id ?? null);
                        deleteRecord(active.record.id);
                      }}>
                        <IconTrash aria-hidden="true" />{t("rec.delete")}
                      </button>
                    </div>
                  </article>
                ) : <div className="qh-empty"><IconMessageQuestion aria-hidden="true" /></div>}
              </div>
            </div>
            {records.some((r) => r.status !== "running") && (
              <div className="qh-foot">
                <span className="qh-keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd><kbd>Enter</kbd></span>
                <ClearQuestions />
              </div>
            )}
          </div>
        </div>,
        document.body)}
    </>
  );
}

/** Clears the question log after a second click. */
function ClearQuestions() {
  const t = useAssistT();
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <span className="qh-clear">
      <button type="button" className="ar-tool danger" onClick={() => { clearRecords("qa"); setConfirming(false); }}>
        {t("rec.clearConfirm")}</button>
      <button type="button" className="ar-tool" onClick={() => setConfirming(false)}>{t("rec.cancel")}</button>
    </span>
  ) : (
    <button type="button" className="ar-tool" onClick={() => setConfirming(true)}>
      <IconTrash aria-hidden="true" />{t("rec.clear")}
    </button>
  );
}
