/** Fact QA (llm.qa, design §7.2): ONE question -> ONE tool-grounded answer. Every question
 * is independent — no conversation history is ever sent to the model or stored server-side
 * (the page says so up front). The answer names entities by English canonical (same
 * contract as agent prose), so it renders through the prose entity renderer and localizes
 * with dex authority.
 *
 * The browser keeps its own record of the questions asked here (lib/runRecords.ts): each answer
 * with the data it was given against, kept in a history panel opened from the composer. While a question runs, the
 * lookups the server makes stream in (`report` events) and the page shows them as they happen.
 * Online runtime only: the route/nav are capability-gated and this chunk is lazy. */
import type { QaAnswerDto, QaProgressDto, QaToolTraceEntry } from "@pokemon-champions/protocol";
import { QA_QUESTION_MAX_CHARS, QaAnswerDtoSchema } from "@pokemon-champions/protocol";
import {
  IconCheck, IconCopy, IconPencil, IconRefresh, IconSparkles,
} from "@tabler/icons-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader.tsx";
import { useLang } from "../i18n.ts";
import { useAssistT } from "./assist/messages.ts";
import { useProseRenderer } from "../lib/prose.tsx";
import { HttpError } from "../runtime/adapter.ts";
import { BudgetNotice } from "./assist/BudgetNotice.tsx";
import { useRuntime } from "../runtime/context.tsx";
import {
  deleteRecord, finishRecord, isCutOff, readResult, readSelected, relativeTime, saveSelected, snapshotOf,
  startRecord, useAssistRecords, type AssistRecord,
} from "../lib/runRecords.ts";
import { Elapsed, FreshnessNote } from "./assist/Workspace.tsx";
import { OnlineNote } from "./assist/OnlineNote.tsx";
import { QaHistory } from "./assist/qa/History.tsx";
import { toolIcon, traceFormats, useTraceLabel, type QaInput } from "./assist/qa/model.ts";

type ErrorKind = "limit" | "busy" | "unavailable" | "budget" | "generic";

/** Pick the copy from the endpoint's typed error code, never from message text. */
function errorKind(e: unknown): ErrorKind {
  if (!(e instanceof HttpError)) return "generic";
  if (e.code === "budget_exhausted") return "budget";
  if (e.status === 429) return e.code === "rate_limited" ? "limit" : "busy";
  if (e.status === 503) return "unavailable";
  return "generic";
}

const EXAMPLE_KEYS = ["qa.ex1", "qa.ex2", "qa.ex3"] as const;
const DRAFT_KEY = "pc-qa-draft";

/** The question in flight, held OUTSIDE React: a round trip is many seconds of tool rounds and
 * switching tabs unmounts this page, so module scope keeps the promise, the record it fills and the
 * lookups streamed so far; a remount re-attaches. */
interface ActiveQa { id: string; promise: Promise<QaAnswerDto> }
let active: ActiveQa | null = null;
const live = new Map<string, QaProgressDto>();
const liveListeners = new Set<() => void>();
let liveVersion = 0;
function setLive(id: string, progress: QaProgressDto | null) {
  if (progress) live.set(id, progress);
  else live.delete(id);
  liveVersion += 1;
  for (const listener of liveListeners) listener();
}
function useLive(id: string): QaProgressDto | undefined {
  useSyncExternalStore((l) => { liveListeners.add(l); return () => { liveListeners.delete(l); }; }, () => liveVersion);
  return live.get(id);
}

function readDraft(): string {
  try { return sessionStorage.getItem(DRAFT_KEY) ?? ""; } catch { return ""; }
}
function writeDraft(text: string) {
  try { sessionStorage.setItem(DRAFT_KEY, text); } catch { /* storage blocked */ }
}

function Lookup({ entry, index }: { entry: QaToolTraceEntry; index: number }) {
  const prose = useProseRenderer();
  const label = useTraceLabel();
  const Icon = toolIcon(entry.tool);
  return (
    <li className="qa-step done" style={{ "--n": index } as CSSProperties}>
      <span className="qa-step-icon"><Icon aria-hidden="true" /></span>
      <span className="qa-step-label">{prose(label(entry))}</span>
      <IconCheck className="qa-step-check" aria-hidden="true" />
    </li>
  );
}

/** A question being answered here: the lookups as the server runs them, then the writing. */
function QaRun({ record }: { record: AssistRecord<QaInput> }) {
  const t = useAssistT();
  const progress = useLive(record.id);
  const trace = progress?.toolTrace ?? [];
  return (
    <section className="ar-run qa-run" aria-live="polite">
      <header className="ar-run-head">
        <span className="ar-run-core" aria-hidden="true" />
        <h2>{t("qa.run.title")}</h2>
        <Elapsed startedAt={record.createdAt} />
      </header>
      <p className="qa-run-q">{record.input.question}</p>
      <ol className="qa-steps">
        <li className={`qa-step ${trace.length ? "done" : "on"}`}>
          <span className="qa-step-icon"><IconSparkles aria-hidden="true" /></span>
          <span className="qa-step-label">{t("qa.run.think")}</span>
          {trace.length > 0 && <IconCheck className="qa-step-check" aria-hidden="true" />}
        </li>
        {trace.map((entry, i) => <Lookup key={i} entry={entry} index={i} />)}
        {trace.length > 0 && (
          <li className="qa-step on" key={`read-${trace.length}`}>
            <span className="qa-step-icon"><IconSparkles aria-hidden="true" /></span>
            <span className="qa-step-label">{t("qa.run.read")}</span>
          </li>
        )}
      </ol>
      <footer className="ar-run-foot num">
        {progress && <span>{t("qa.run.round").replace("{n}", String(progress.round + 1))}</span>}
        {trace.length > 0 && <span>{t("qa.run.lookups").replace("{n}", String(trace.length))}</span>}
      </footer>
    </section>
  );
}

const AnswerCard = memo(function AnswerCard({ record, answer, onAgain, onEdit }: {
  record: AssistRecord<QaInput>; answer: QaAnswerDto; onAgain: () => void; onEdit: () => void;
}) {
  const t = useAssistT();
  const { lang } = useLang();
  const prose = useProseRenderer();
  const label = useTraceLabel();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answer.answer);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the answer stays selectable */ }
  };
  return (
    <article className={`ar-card qa-card${answer.grounded ? "" : " ungrounded"}`}>
      <header className="qa-q">
        <span className="qa-q-mark" aria-hidden="true">Q</span>
        <h2 className="qa-q-text">{record.input.question}</h2>
      </header>
      <FreshnessNote record={record} formats={traceFormats(answer.toolTrace)} action={
        <button type="button" className="aw-fresh-act" onClick={onAgain}>{t("qa.again")}</button>} />
      <div className="qa-a">
        {answer.answer.split(/\n+/).map((para, i) => <p key={i} className="qa-answer-text">{prose(para)}</p>)}
      </div>
      {/* No tool grounded this reply → it's a decline/out-of-scope note, never a Champions
          fact. Say so, so the site's "backed by deterministic queries" promise isn't overclaimed. */}
      {!answer.grounded && <p className="notice qa-ungrounded">{t("qa.ungrounded")}</p>}
      {answer.toolTrace.length > 0 && (
        <div className="qa-sources">
          <span className="qa-sources-label">{t("qa.sources")}</span>
          <ul className="qa-source-list">
            {answer.toolTrace.map((entry, i) => {
              const Icon = toolIcon(entry.tool);
              return (
                <li key={i} className="qa-source" title={entry.tool}>
                  <Icon aria-hidden="true" />{prose(label(entry))}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <footer className="ar-card-foot">
        <span className="ar-card-time num">{relativeTime(record.createdAt, lang, t("rec.justNow"))}</span>
        <span className="ar-card-tools">
          <button type="button" className="ar-tool" onClick={() => void copy()}>
            {copied ? <IconCheck aria-hidden="true" /> : <IconCopy aria-hidden="true" />}
            {t(copied ? "qa.copied" : "qa.copy")}
          </button>
          <button type="button" className="ar-tool" onClick={onEdit}>
            <IconPencil aria-hidden="true" />{t("qa.edit")}
          </button>
          <button type="button" className="ar-tool" onClick={onAgain}>
            <IconRefresh aria-hidden="true" />{t("qa.again")}
          </button>
        </span>
      </footer>
    </article>
  );
});

/** A question that never got its answer (its page was closed or reloaded mid-request). */
function Unanswered({ record, note, onAgain }: { record: AssistRecord<QaInput>; note: string; onAgain?: () => void }) {
  const t = useAssistT();
  return (
    <article className="ar-card qa-card muted-card">
      <header className="qa-q">
        <span className="qa-q-mark" aria-hidden="true">Q</span>
        <h2 className="qa-q-text">{record.input.question}</h2>
      </header>
      <p className="ar-card-note">{note}</p>
      {onAgain && (
        <div className="ar-card-actions">
          <button type="button" className="primary-btn" onClick={onAgain}>{t("qa.again")}</button>
        </div>
      )}
    </article>
  );
}

export function QaPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { adapter, capabilities } = useRuntime();
  const t = useAssistT();
  const { lang } = useLang();
  // `?q=` (the home page's ask box and examples) only fills the box: sending spends the reader's
  // allowance, so it stays their click. The parameter is dropped once read, so a reload keeps the
  // reader's own edits.
  const [params, setParams] = useSearchParams();
  const handed = params.get("q")?.slice(0, QA_QUESTION_MAX_CHARS) ?? null;
  const [question, setQuestion] = useState(() => handed ?? readDraft());
  const questionBox = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (handed === null) return;
    setQuestion(handed);
    const next = new URLSearchParams(params);
    next.delete("q");
    setParams(next, { replace: true });
  }, [handed]);
  useEffect(() => writeDraft(question), [question]);

  const { records } = useAssistRecords<QaInput>("qa");
  const [selected, setSelected] = useState<string | null>(() => readSelected("qa"));
  const current = records.find((r) => r.id === selected) ?? records[0] ?? null;
  const select = useCallback((id: string | null) => { setSelected(id); saveSelected("qa", id); }, []);

  const [asking, setAsking] = useState(() => active !== null);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  useEffect(() => {
    let alive = true;
    adapter.quota?.().then((all) => { if (alive) setQuota(all.qa); }, () => {});
    return () => { alive = false; };
  }, [adapter]);

  // Re-attach to a question still in flight from an earlier mount of this page.
  useEffect(() => {
    const task = active;
    if (!task) return;
    let alive = true;
    setAsking(true);
    task.promise.then((answer) => { if (alive) setQuota(answer.quota); },
      (reason: unknown) => { if (alive) setError(errorKind(reason)); })
      .finally(() => { if (alive) setAsking(false); });
    return () => { alive = false; };
  }, []);

  const ask = useCallback(async (raw: string, clearDraft = false) => {
    const q = raw.trim().slice(0, QA_QUESTION_MAX_CHARS);
    if (!q || asking || active || !adapter.qa) return;
    setAsking(true);
    setError(null);
    const record = startRecord<QaInput>("qa", { question: q }, lang, snapshotOf(capabilities));
    select(record.id);
    const promise = adapter.qa({ question: q, lang }, (progress) => setLive(record.id, progress));
    active = { id: record.id, promise };
    try {
      // This continuation runs whether or not the page is still mounted, so the answer lands in
      // the record either way.
      const answer = await promise;
      finishRecord(record.id, answer);
      setQuota(answer.quota);
      if (clearDraft) setQuestion("");
    } catch (e) {
      // A refused or failed question leaves no record: there is nothing to keep but the question,
      // and it is still in the box.
      deleteRecord(record.id);
      setError(errorKind(e));
    } finally {
      active = null;
      setLive(record.id, null);
      setAsking(false);
    }
  }, [adapter, asking, lang, capabilities, select]);

  const edit = useCallback((text: string) => {
    setQuestion(text);
    requestAnimationFrame(() => {
      questionBox.current?.focus();
      questionBox.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, []);
  const again = useCallback(() => { if (current) void ask(current.input.question); }, [ask, current]);
  const editCurrent = useCallback(() => { if (current) edit(current.input.question); }, [edit, current]);

  const answered = useMemo(() => {
    if (!current || current.status !== "done") return null;
    return readResult(current, QaAnswerDtoSchema) ?? undefined;
  }, [current]);

  const view = (() => {
    if (!current) return null;
    if (current.status === "running") {
      if (active?.id === current.id) return <QaRun record={current} />;
      return isCutOff(current)
        ? <Unanswered record={current} note={t("rec.interruptedNote")} onAgain={() => void ask(current.input.question)} />
        : <Unanswered record={current} note={t("qa.run.elsewhere")} />;
    }
    if (answered) {
      return <AnswerCard record={current} answer={answered} onAgain={again} onEdit={editCurrent} />;
    }
    return <Unanswered record={current} note={t("rec.unreadable")} onAgain={() => void ask(current.input.question)} />;
  })();

  return (
    <div>
      {!embedded && <PageHeader title={t("qa.title")} description={<OnlineNote />} />}
      <div className="aw aw-qa">
        <p className="notice page-disclosure">{t("qa.disclosure")}</p>
        <div className="aw-composer qa-composer">
          <textarea
            ref={questionBox}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void ask(question, true);
              }
            }}
            maxLength={QA_QUESTION_MAX_CHARS}
            rows={3}
            placeholder={t("qa.placeholder")}
            aria-label={t("qa.title")}
          />
          <div className="qa-composer-bar">
            <span className="qa-examples">
              {EXAMPLE_KEYS.map((k) => (
                <button key={k} type="button" className="qa-example"
                  // An example fills the box; sending stays the reader's choice (a question spends
                  // model quota, and the reader may want to adjust it first).
                  onClick={() => edit(t(k))}>
                  {t(k)}
                </button>
              ))}
            </span>
            <span className="aw-submit">
              <QaHistory records={records} selected={current?.id ?? null} onOpen={select}
                onAgain={(q) => void ask(q)} />
              <span className={`aw-quota num${quota ? "" : " pending"}`}>
                {t("qa.quota")} {!quota ? "—" : quota.limit === 0 ? t("quota.unlimited") : `${quota.used}/${quota.limit}`}
              </span>
              <button type="button" className="primary-btn" disabled={asking || !question.trim()}
                onClick={() => void ask(question, true)}>
                {asking ? t("qa.asking") : t("qa.ask")}
              </button>
            </span>
          </div>
        </div>

        {error === "budget" && <BudgetNotice />}
        {error && error !== "budget" && <p className="notice qa-error">{t(`qa.error.${error}`)}</p>}
        {view}
      </div>
    </div>
  );
}
