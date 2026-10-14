/** Home (frontend/design.md §2.5): a launchpad, not a landing page. The top bar already names every
 * page, so nothing here only repeats a link: each cell starts a task with the reader's own input and
 * hands it to the tool that owns it. The free, deterministic task leads (diagnosis spends no model
 * quota); the model-backed ones follow; plain lookups go to the search and the calculator.
 *
 * The first screen renders from the handshake alone: no data request and no sprite (one GameImage
 * would fetch the asset index before anything else could paint). The metagame glance sits below the
 * fold, loads when it nears the viewport, and fails without touching the rest of the page. */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  IconCalculator, IconMessageQuestion, IconPokeball, IconSearch, IconSparkles, IconStethoscope,
} from "@tabler/icons-react";
import { FormatTabs } from "../components/FormatTabs.tsx";
import { SegmentedControl, segmentedPanelId, segmentedTabId } from "../components/SegmentedControl.tsx";
import { useSiteSearch } from "../components/SideRail.tsx";
import { useLang, useT } from "../i18n.ts";
import { stashBuilderFill } from "../lib/builderHandoff.ts";
import { stashDiagnoseFill, stashDiagnoseText } from "../lib/diagnoseHandoff.ts";
import { useLibraryDrop, useLibraryReceiver, useLibraryWorkspace } from "../lib/library/workspace.tsx";
import { useRuntime } from "../runtime/context.tsx";
import { BuildFlow } from "./home/BuildFlow.tsx";
import { Hero } from "./home/Hero.tsx";
import { Install } from "./home/Install.tsx";
import { Lab } from "./home/Lab.tsx";
import { SectionHead } from "./home/SectionHead.tsx";
import { readSheet } from "./home/teamSheet.ts";
import { HOME_TACTICS, useHomeDraft, type HomeTask } from "./home/draft.ts";
import { HOME_EXAMPLES, exampleName } from "./home/example.ts";
import "../styles.home.css";

const EnvGlance = lazy(() => import("./home/EnvGlance.tsx").then((m) => ({ default: m.EnvGlance })));

/** Query keys the ranking answered at "/" before this page existed; shared links still carry them. */
const LEGACY_RANKING_PARAMS = ["view", "format", "trend"];
const SLOTS = [1, 2, 3, 4, 5, 6];
const TASK_ICONS = { diagnose: IconStethoscope, build: IconSparkles, ask: IconMessageQuestion } as const;
/** The Q&A page's own examples: each one needs data joined up, which is what the model is for. */
const QA_EXAMPLES = ["qa.ex1", "qa.ex2", "qa.ex3"] as const;
/** What the Q&A model can call (bridge pcui/online/qa.py tools), grouped as a reader names them. */
const QA_SOURCES = ["dex", "find", "ranking", "sets", "real", "speed", "damage"] as const;

/** True once the element comes within 200px of the viewport (then stays true). */
function useNearViewport<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    if (typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNear(true);
    }, { rootMargin: "200px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);
  return [ref, near];
}

/** Sections below the first screen enter once, the first time they scroll into view: each carries
 * `data-reveal`, set to "wait" (held back) and then "play" (styles.home.css runs the entrance). What is
 * already on screen at load is never held back, and without an observer or with reduced motion
 * nothing is. */
function useReveal(root: RefObject<HTMLElement | null>) {
  // The observer's first report places each section from the browser's own layout pass (reading the
  // places directly forced the whole page's first layout inside the render). A section starting in
  // view is left as is; one starting below the fold is held, unseen, until it scrolls in.
  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const sections = node.querySelectorAll<HTMLElement>("[data-reveal]");
    const fresh = new WeakSet<Element>(sections);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const section = entry.target as HTMLElement;
        if (fresh.delete(section) && entry.boundingClientRect.top <= window.innerHeight * 0.92) {
          observer.unobserve(section);
        } else if (!entry.isIntersecting) {
          section.dataset.reveal = "wait";
        } else {
          section.dataset.reveal = "play";
          observer.unobserve(section);
        }
      }
    }, { rootMargin: "0px 0px -12% 0px" });
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [root]);
}

/** One underline for the board's tabs, sliding to the chosen one: its place is written as --tab-x and
 * --tab-w on the tab row, measured again whenever a tab's width changes (language, font load). */
function useTabIndicator(nav: RefObject<HTMLElement | null>, task: string | undefined) {
  // Placed from the observer, whose first report comes after the browser's own layout pass:
  // reading the tab's place directly forced the whole page's first layout inside the render.
  useEffect(() => {
    const node = nav.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const place = () => {
      const on = node.querySelector<HTMLElement>("[role=tab].on");
      if (!on) return;
      node.style.setProperty("--tab-x", `${on.offsetLeft}px`);
      node.style.setProperty("--tab-w", `${on.offsetWidth}px`);
    };
    const observer = new ResizeObserver(place);
    for (const tab of node.querySelectorAll("[role=tab]")) observer.observe(tab);
    return () => observer.disconnect();
  }, [nav, task]);
}

export function HomePage() {
  const location = useLocation();
  const legacy = new URLSearchParams(location.search);
  if (LEGACY_RANKING_PARAMS.some((key) => legacy.has(key))) {
    return <Navigate to={`/ranking${location.search}`} replace />;
  }
  return <Launchpad />;
}

function Launchpad() {
  const t = useT();
  const { adapter, can } = useRuntime();
  const canDiagnose = can("team.validate") && !!adapter.diagnose;
  const canBuild = can("llm.builder") && !!adapter.builder;
  const canSession = !canBuild && can("team.uep");
  const canAsk = can("llm.qa") && !!adapter.qa;
  const [glanceRef, glanceNear] = useNearViewport<HTMLElement>();
  const home = useRef<HTMLDivElement>(null);
  const tabRow = useRef<HTMLDivElement>(null);
  const [savedTask, setTask] = useHomeDraft("task");
  const tasks: HomeTask[] = [...(canDiagnose ? ["diagnose" as const] : []),
    ...(canBuild || canSession ? ["build" as const] : []), ...(canAsk ? ["ask" as const] : [])];
  const task = tasks.includes(savedTask) ? savedTask : tasks[0];
  const panel = (id: HomeTask) => ({ id: segmentedPanelId("home-task", id), role: "tabpanel",
    "aria-labelledby": segmentedTabId("home-task", id), hidden: task !== id });
  // The local runtime already runs on the installed skills: it gets no demo note and no install pitch.
  const online = !can("team.uep");
  // The assistant page exists when any of its three tools does (App.tsx's own condition); a local
  // runtime starts in its agent sessions.
  const start = canSession ? "/sessions" : canDiagnose || canAsk || canBuild ? "/assist" : "/calc";
  useReveal(home);
  useTabIndicator(tabRow, task);

  return (
    <div ref={home} className="home">
      <Hero online={online} start={start} />

      <div id="home-start" className="panel home-board">
        {task && <div ref={tabRow} className="home-board-nav"><SegmentedControl kind="tabs" idBase="home-task" value={task}
          onChange={setTask} ariaLabel={t("home.tasks")} className="home-task-tabs"
          items={tasks.map((id) => {
            const Icon = TASK_ICONS[id];
            return { id, label: <><Icon aria-hidden="true" />{t(`home.task.${id}`)}</> };
          })} /></div>}
        {/* Every panel shares one grid cell, so the board keeps the tallest one's height and a
            tab switch never moves the page below it. */}
        <div className="home-board-panels">
        {canDiagnose && <div {...panel("diagnose")}><DiagnoseCell active={task === "diagnose"} /></div>}
        {canBuild && <div {...panel("build")}><BuildCell active={task === "build"} /></div>}
        {canSession && <div {...panel("build")}>
          <section className="home-cell home-session" aria-labelledby="home-session">
            <h2 id="home-session" className="home-cell-lead">{t("home.session.body")}</h2>
            <div className="home-cell-actions">
              <Link className="primary-btn" to="/sessions">{t("home.session.go")}</Link>
            </div>
          </section></div>}
        {canAsk && <div {...panel("ask")}><AskStrip canAsk /></div>}
        {!tasks.length && <AskStrip canAsk={false} />}
        </div>
      </div>

      <Lab />

      <section ref={glanceRef} className="home-glance" aria-labelledby="home-glance-heading" data-reveal="">
        <SectionHead id="home-glance-heading" title={t("home.glance")} mark="glance" />
        <div className="panel home-glance-board">
          {glanceNear ? (
            <Suspense fallback={<><GlanceFallback /><GlanceFallback /></>}>
              <EnvGlance />
            </Suspense>
          ) : <><GlanceFallback /><GlanceFallback /></>}
        </div>
      </section>

      {online && <Install />}
    </div>
  );
}

/** The board's two halves at their final height until the glance and its data arrive. */
function GlanceFallback() {
  return (
    <div className="home-glance-half" aria-busy="true">
      <div className="home-glance-head"><span className="home-glance-bar short" /></div>
      <ol className="home-glance-list skeleton" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => <li key={i}><span className="home-glance-bar" /></li>)}
      </ol>
    </div>
  );
}

/** Paste a team, see it read as six slots, take it to the diagnosis page. A saved team arrives from
 * the library dock the way every page receives one: the dock's "fill this page", or a drop here. */
function DiagnoseCell({ active }: { active: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const { capabilities } = useRuntime();
  const navigate = useNavigate();
  const { setOpen, active: currentTeam, fillActiveTeam } = useLibraryWorkspace("setOpen", "active", "fillActiveTeam");
  const [draftText, setText] = useHomeDraft("team");
  const [format, setFormat] = useHomeDraft("diagnoseFormat");
  // Each format has its own example; one is offered only while its rule is the runtime's.
  const example = HOME_EXAMPLES[format];
  const sampleAvailable = capabilities.environment.rule === example.rule;
  const text = draftText ?? (sampleAvailable ? example.text : "");
  const isExample = Object.values(HOME_EXAMPLES).some((e) => e.text === text);
  // An untouched example follows the format switch; the reader's own text never does.
  const chooseFormat = (next: typeof format) => {
    setFormat(next);
    if (isExample) setText(null);
  };
  const [takingTeam, setTakingTeam] = useState(false);
  const read = useMemo(() => readSheet(text), [text]);
  const filled = read?.known ? read.mons : [];

  useLibraryReceiver(active ? {
    id: "home-diagnose", kind: "team", label: t("home.diag.go"),
    receive: ({ doc }) => {
      stashDiagnoseFill(doc);
      navigate("/assist?tab=diagnose");
      return { ok: true };
    },
  } : null);
  const drop = useLibraryDrop(["home-diagnose"]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim()) stashDiagnoseText(text.trim(), format);
    navigate("/assist?tab=diagnose");
  };

  return (
    <form className="home-cell home-diag" aria-labelledby="home-diag" onSubmit={submit} {...drop}>
      <div className="home-cell-heading">
        <h2 id="home-diag" className="home-cell-lead">{t("home.diag.body")}</h2>
        <FormatTabs format={format} onChange={chooseFormat} />
      </div>
      <div className="home-paste">
        <textarea value={text} onChange={(event) => setText(event.target.value)} spellCheck={false}
          placeholder={t("home.diag.placeholder")} aria-label={t("home.task.diagnose")} />
        <div className="home-sheet">
          <div className="home-sheet-head" aria-live="polite">
            {read === null ? (
              <span>{t("home.diag.sheet")}</span>
            ) : read.known ? (
              <span className={read.extra ? "warn" : undefined}>
                {read.extra
                  ? t("home.diag.extra").replace("{n}", String(read.extra))
                  : t("home.diag.read").replace("{n}", String(read.mons.length))}
              </span>
            ) : (
              <span>{t("home.diag.unread")}</span>
            )}
          </div>
          <ol aria-label={t("home.diag.sheet")}>
            {SLOTS.map((slot, i) => {
              const mon = filled[i];
              return (
                <li key={slot} className={mon ? "on" : undefined}>
                  <span className="home-slot num" aria-hidden="true">{slot}</span>
                  {mon && (
                    <span className="home-slot-mon">
                      <span className="home-slot-name" title={mon.species}>{exampleName(mon.species, lang)}</span>
                      {mon.item && <span className="home-slot-item">{mon.item}</span>}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div className="home-cell-actions">
        <button type="submit" className="primary-btn">{t(text.trim() ? "home.diag.go" : "home.diag.empty")}</button>
        {sampleAvailable && !isExample && <button type="button" className="home-text-btn" onClick={() => setText(null)}>
          {t("home.diag.restore")}</button>}
        {text && <button type="button" className="home-text-btn" onClick={() => setText("")}>{t("home.diag.clear")}</button>}
        {currentTeam && <button type="button" className="home-text-btn" disabled={takingTeam}
          onClick={() => { setTakingTeam(true); void fillActiveTeam("home-diagnose").finally(() => setTakingTeam(false)); }}>
          {t("home.diag.current")}</button>}
        <button type="button" className="home-text-btn home-library" onClick={() => setOpen(true)}>
          <IconPokeball aria-hidden="true" />
          {t("home.diag.library")}
        </button>
      </div>
    </form>
  );
}

/** The three choices that shape a build; the wizard asks for the rest. */
function BuildCell({ active }: { active: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const [format, setFormat] = useHomeDraft("format");
  const [posture, setPosture] = useHomeDraft("posture");
  const [anchor, setAnchor] = useHomeDraft("anchor");
  const [wants, setWants] = useHomeDraft("wants");
  const toggle = (tactic: (typeof HOME_TACTICS)[number]) =>
    setWants(wants.includes(tactic) ? wants.filter((w) => w !== tactic) : [...wants, tactic]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    stashBuilderFill({ format, posture, anchor: anchor.trim(), wants });
    navigate("/assist?tab=wizard");
  };

  return (
    <form className="home-cell home-build" aria-labelledby="home-build" onSubmit={submit}>
      <h2 id="home-build" className="home-cell-lead">{t("home.build.body")}</h2>
      <div className="home-fields">
        <div className="home-field">
          <span className="home-field-label">{t("home.build.format")}</span>
          <FormatTabs format={format} onChange={setFormat} />
        </div>
        <div className="home-field core">
          <label className="home-field-label" htmlFor="home-build-core">{t("home.build.core")}</label>
          <input id="home-build-core" value={anchor} maxLength={100} autoComplete="off"
            onChange={(event) => setAnchor(event.target.value)} placeholder={t("home.build.coreHint")} />
        </div>
        <div className="home-field">
          <span className="home-field-label">{t("home.build.style")}</span>
          <SegmentedControl kind="radio" value={posture} onChange={setPosture} className="seg"
            ariaLabel={t("home.build.style")}
            items={(["offense", "balance", "defense"] as const).map((id) => ({ id, label: t(`home.build.${id}`) }))} />
        </div>
        <div className="home-field tactics" role="group" aria-labelledby="home-build-tactics">
          <span id="home-build-tactics" className="home-field-label">{t("home.build.tactics")}</span>
          <div className="home-chips">
            {HOME_TACTICS.map((tactic) => (
              <button key={tactic} type="button" className={`home-chip${wants.includes(tactic) ? " on" : ""}`}
                aria-pressed={wants.includes(tactic)} onClick={() => toggle(tactic)}>
                {t(`home.tactic.${tactic}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <BuildFlow running={active} />
      <div className="home-cell-actions">
        <button type="submit" className="primary-btn">{t("home.build.go")}</button>
      </div>
    </form>
  );
}

/** Questions: the model answers the ones that need data joined up; lookups and exact numbers go to
 * the search and the calculator, which cost nothing (roadmap §1.4). */
function AskStrip({ canAsk }: { canAsk: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const { can } = useRuntime();
  const { setFallbackOpen } = useSiteSearch();
  const [question, setQuestion] = useHomeDraft("question");
  const ask = (text: string) => navigate(`/assist?q=${encodeURIComponent(text.trim())}`);

  const lookups = (
    <div className="home-lookup">
      <button type="button" className="home-text-btn" onClick={() => setFallbackOpen(true)}>
        <IconSearch aria-hidden="true" />
        {t("home.lookup.search")}
        <kbd>/</kbd>
      </button>
      {can("calc.damage") && (
        <Link className="home-text-btn" to="/calc">
          <IconCalculator aria-hidden="true" />
          {t("home.lookup.calc")}
        </Link>
      )}
    </div>
  );

  // With no task to start, the board still offers the two free ways in.
  if (!canAsk) return <section className="home-cell home-ask">{lookups}</section>;
  const send = () => { if (question.trim()) ask(question); };
  return (
    <section className="home-cell home-ask" aria-labelledby="home-ask">
      <div className="home-ask-head">
        <h2 id="home-ask" className="home-cell-lead">{t("home.qa.body")}</h2>
        <div className="home-sources" aria-label={t("home.qa.sources")}>
          <span className="home-sources-label">{t("home.qa.sources")}</span>
          {QA_SOURCES.map((id) => <span key={id} className="home-source">{t(`home.qa.src.${id}`)}</span>)}
        </div>
      </div>
      <form className="home-ask-row" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <textarea value={question} maxLength={400} rows={3} onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          placeholder={t("home.qa.placeholder")} aria-label={t("home.task.ask")} />
        <button type="submit" className="primary-btn" disabled={!question.trim()}>{t("home.qa.go")}</button>
      </form>
      <div className="home-examples">
        <span className="home-examples-label">{t("home.qa.examples")}</span>
        <div className="home-example-list">
          {QA_EXAMPLES.map((key) => (
            <button key={key} type="button" className="home-example" onClick={() => ask(t(key))}>{t(key)}</button>
          ))}
        </div>
      </div>
    </section>
  );
}
