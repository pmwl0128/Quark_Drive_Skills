/** Local work starts from the reader's saved team and actual session evidence. */
import type { FormatId, TeamDoc } from "@pokemon-champions/protocol";
import {
  IconArrowRight, IconCalculator, IconChevronRight, IconHistory, IconPlus,
  IconShield, IconSparkles, IconTargetArrow, IconTimeline, IconUsers,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AdaptiveSelect } from "../components/AdaptiveSelect.tsx";
import { FormatTabs } from "../components/FormatTabs.tsx";
import { GameImage } from "../components/GameImage.tsx";
import { SessionState } from "../components/session/SessionState.tsx";
import { formatDay, speciesLabel, speciesSlug, useRuleChange, useTeamLabel } from "../components/library/shared.tsx";
import { useAsync, useDexByName } from "../hooks.ts";
import { useLang, useT } from "../i18n.ts";
import { useLibrary } from "../lib/library/hooks.ts";
import { boxById, teamDocOf } from "../lib/library/repo.ts";
import { useLibraryWorkspace } from "../lib/library/workspace.tsx";
import { stashCalcTeams, stashMatchupFill, stashTuneFill, teamToCalcMembers } from "../lib/team.ts";
import { useRuntime } from "../runtime/context.tsx";
import { useLocalT } from "./local/messages.ts";
import "../styles.local.css";

const TASKS = ["build", "rework", "diagnose", "tune"] as const;
type Task = typeof TASKS[number];
const TASK_LABELS = { build: "build", rework: "edit", diagnose: "review", tune: "adjust" } as const;
const DRAFT_KEY = "pc-local-request-v1";
function readDraft(): string {
  try { return sessionStorage.getItem(DRAFT_KEY) ?? ""; } catch { return ""; }
}

function RecentSessions() {
  const { adapter } = useRuntime();
  const { lang } = useLang();
  const t = useLocalT();
  const [version, refresh] = useState(0);
  const sessions = adapter.sessions;
  const list = useAsync(() => sessions?.list({ limit: 4, prioritizeDecisions: true }) ?? Promise.resolve([]), [sessions, version]);
  useEffect(() => sessions?.subscribe(() => refresh(value => value + 1)), [sessions]);
  return (
    <section className="local-panel local-continue" aria-labelledby="local-continue-heading">
      <header className="local-section-head"><h2 id="local-continue-heading">{t("recent")}</h2>
        <Link to="/sessions">{t("allSessions")}<IconChevronRight aria-hidden /></Link></header>
      {list.status === "loading" ? <p className="local-muted" role="status">{t("state.loading")}</p>
        : list.status === "error" ? <div className="local-empty-session"><p>{t("sessionError")}</p>
          <button type="button" className="second-btn" onClick={() => refresh(value => value + 1)}>{t("retry")}</button></div>
        : list.data.length ? <div className="local-session-list">{list.data.map(session => (
          <Link className="local-session" key={session.id} to={`/sessions/${session.id}`}>
            <div><SessionState session={session} /><time dateTime={session.updatedAt ?? session.createdAt}>
              {formatDay(Date.parse(session.updatedAt ?? session.createdAt), lang)}</time></div>
            <strong>{typeof session.meta.intent === "string" && session.meta.intent ? session.meta.intent : session.id}</strong>
            <IconArrowRight className="local-session-arrow" aria-hidden />
          </Link>
        ))}</div> : <div className="local-empty-session"><IconHistory size={28} aria-hidden />
          <h3>{t("emptySessions")}</h3><p>{t("emptySessionsBody")}</p>
          <a href="#local-request">{t("newSession")}<IconArrowRight aria-hidden /></a></div>}
    </section>
  );
}

function Tools() {
  const t = useLocalT();
  const { can } = useRuntime();
  const tools = [
    { id: "damage", body: "damageBody", to: "/calc", icon: IconCalculator, show: can("calc.damage") },
    { id: "speed", body: "speedBody", to: "/calc?tab=speed", icon: IconTimeline, show: can("calc.speedline") },
    { id: "durability", body: "durabilityBody", to: "/calc?tab=tune", icon: IconShield, show: can("team.tune") },
    { id: "inference", body: "inferenceBody", to: "/calc?tab=infer", icon: IconTargetArrow, show: can("calc.damage") },
  ] as const;
  return <section className="local-panel local-tools" aria-labelledby="local-tools-heading">
    <header className="local-section-head"><h2 id="local-tools-heading">{t("tools")}</h2></header>
    <div>{tools.filter(tool => tool.show).map(tool => <Link key={tool.id} className="local-tool" to={tool.to}>
      <span className="local-tool-icon"><tool.icon size={20} aria-hidden /></span>
      <span><strong>{t(tool.id)}</strong><small>{t(tool.body)}</small></span><IconChevronRight aria-hidden />
    </Link>)}</div>
  </section>;
}

function NewTask({ team, name, startTask, focusVersion }: {
  team: TeamDoc | null; name: string; startTask: Task; focusVersion: number;
}) {
  const t = useLocalT();
  const st = useT();
  const { adapter, capabilities } = useRuntime();
  const navigate = useNavigate();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [intent, setIntent] = useState(readDraft);
  const [task, setTask] = useState<Task>(startTask);
  const [format, setFormat] = useState<FormatId>(team?.format ?? "double");
  const [attach, setAttach] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(false);
  const attached = attach && team ? team : null;
  useEffect(() => {
    if (focusVersion) { setTask(startTask); textarea.current?.focus(); }
  }, [focusVersion, startTask]);
  const update = (value: string) => {
    setIntent(value);
    try { sessionStorage.setItem(DRAFT_KEY, value); } catch { /* draft stays in memory */ }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!intent.trim() || !adapter.sessions || creating) return;
    setCreating(true); setError(false);
    try {
      const session = await adapter.sessions.create({
        intent: intent.trim(), requestKind: task, format: attached?.format ?? format,
        ...(attached ? { team: attached, teamName: name } : {}),
        environment: { ...capabilities.environment },
      });
      update("");
      navigate(`/sessions/${session.id}`);
    } catch { setError(true); setCreating(false); }
  };
  return <section className="local-panel local-request" id="local-request" aria-labelledby="local-request-heading">
    <header className="local-section-head"><h2 id="local-request-heading">{t("newSession")}</h2><IconSparkles size={20} aria-hidden /></header>
    <form onSubmit={submit}>
      <div className="local-task-types" role="group" aria-label={t("newSession")}>{TASKS.map(kind =>
        <button key={kind} type="button" aria-pressed={task === kind} onClick={() => setTask(kind)}>{t(TASK_LABELS[kind])}</button>)}</div>
      <label className="sr-only" htmlFor="local-intent">{t("request")}</label>
      <textarea id="local-intent" ref={textarea} value={intent} onChange={event => update(event.target.value)} rows={3} maxLength={8000}
        placeholder={t(task === "build" ? "buildPh" : task === "rework" ? "reworkPh" : task === "diagnose" ? "diagnosePh" : "tunePh")} />
      <div className="local-request-options">
        {team ? <label className="local-attach"><input type="checkbox" checked={attach} onChange={event => setAttach(event.target.checked)} />
          <span>{t("attach")}<small>{name}</small></span></label> : null}
        {attached ? <span className="local-format">{st(`format.${attached.format}`)} · {t("attached")}</span>
          : <FormatTabs format={format} onChange={setFormat} />}
      </div>
      <div className="local-request-submit"><p>{t("requestHint")}</p>
        <button type="submit" className="primary-btn" disabled={creating || !intent.trim()}>
          {creating ? t("creating") : t("create")}<IconArrowRight size={17} aria-hidden /></button></div>
      {error ? <p className="local-error" role="alert">{t("createError")}</p> : null}
    </form>
  </section>;
}

export function LocalHomePage() {
  const t = useLocalT();
  const st = useT();
  const { lang } = useLang();
  const { capabilities, can } = useRuntime();
  const library = useLibrary();
  const dex = useDexByName();
  const label = useTeamLabel(dex, lang);
  const ruleChange = useRuleChange();
  const { active, setActive } = useLibraryWorkspace("active", "setActive");
  const navigate = useNavigate();
  const location = useLocation();
  const [task, setTask] = useState<Task>("build");
  const [focusVersion, setFocusVersion] = useState(0);
  const state = library && library !== "unavailable" ? library : null;
  const box = useMemo(() => state ? boxById(state) : new Map(), [state]);
  const teams = useMemo(() => state ? [...state.teams].sort((a, b) => b.updatedAt - a.updatedAt) : [], [state]);
  const record = teams.find(team => team.id === active?.id);
  const doc = record ? teamDocOf(record, box) : null;
  const teamName = record ? label(record.name, doc).text : "";
  const changed = record ? ruleChange(record.snapshot) : null;
  const { season, rule, asOf } = capabilities.environment;
  const openTask = (kind: Task) => {
    setTask(kind); setFocusVersion(value => value + 1);
    document.getElementById("local-request")?.scrollIntoView({ block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const sendCalc = (tab: "damage" | "speed" = "damage") => {
    if (doc) stashCalcTeams({ format: doc.format, attackers: teamToCalcMembers(doc), defenders: [] });
    navigate(`/calc?tab=${tab}`);
  };
  const legacy = new URLSearchParams(location.search);
  if (["view", "format", "trend"].some(key => legacy.has(key))) {
    return <Navigate to={`/ranking${location.search}`} replace />;
  }
  return <div className="local-home">
    <header className="local-page-head"><div><h1>{t("title")}<span>{t("workspace")}</span></h1></div>
      <div className="local-snapshot"><span>{season} · {rule}</span>{asOf ? <time dateTime={asOf}>{asOf}</time> : null}</div></header>
    <div className="local-grid">
      <section className="local-panel local-team" aria-labelledby="local-team-heading">
        <header className="local-section-head"><h2 id="local-team-heading">{t("currentTeam")}</h2><Link to="/teams">{t("manage")}<IconChevronRight aria-hidden /></Link></header>
        {state && teams.length ? <AdaptiveSelect className="local-team-select" aria-label={t("chooseTeam")} value={record?.id ?? ""}
          onValueChange={id => { const found = teams.find(team => team.id === id); if (found) setActive({ id, format: found.format }); }}>
          <option value="" disabled>{t("chooseTeam")}</option>
          {teams.map(team => <option key={team.id} value={team.id}>{label(team.name, teamDocOf(team, box)).text} · {st(`format.${team.format}`)}</option>)}
        </AdaptiveSelect> : null}
        {library === undefined ? <p className="local-muted" role="status">{t("state.loading")}</p>
          : doc ? <>
            <div className="local-roster">{Array.from({ length: 6 }, (_, index) => {
              const mon = doc.pokemon[index];
              return <div key={index} className={`local-member${mon ? "" : " empty"}`}>
                {mon ? <><GameImage assetKey={`pokemon:${speciesSlug(mon.species, dex)}`} role="dense" alt="" />
                  <span title={speciesLabel(mon.species, dex, lang)}>{speciesLabel(mon.species, dex, lang)}</span></>
                  : <span className="local-slot num">{String(index + 1).padStart(2, "0")}</span>}
              </div>;
            })}</div>
            {changed ? <p className="local-rule-note">{t("ruleChanged")}</p> : null}
            <div className="local-team-actions">
              <button type="button" className="primary-btn" onClick={() => openTask("diagnose")}>{t("aiDiagnose")}<IconArrowRight size={16} aria-hidden /></button>
              {can("team.matchup") ? <button type="button" className="second-btn" onClick={() => {
                stashMatchupFill({ source: "other", label: teamName, format: doc.format, team: doc }); navigate("/matchup?mode=actual");
              }}>{t("matchup")}</button> : null}
              {can("team.tune") ? <button type="button" className="second-btn" onClick={() => {
                stashTuneFill({ team: doc, label: teamName }); navigate("/calc?tab=tune");
              }}>{t("tune")}</button> : null}
              <button type="button" className="local-text-button" onClick={() => openTask("rework")}>{t("rework")}</button>
            </div>
          </> : <div className="local-team-empty"><div className="local-empty-mark"><IconUsers size={32} aria-hidden /></div>
            <h3>{teams.length ? t("chooseTeam") : t("emptyTitle")}</h3>
            <p>{library === "unavailable" ? t("unavailable") : teams.length ? t("selectHint") : t("emptyBody")}</p>
            <div><Link className="primary-btn" to="/teams"><IconPlus size={17} aria-hidden />{t("import")}</Link>
              <button type="button" className="second-btn" onClick={() => sendCalc()}>{t("damage")}</button></div>
          </div>}
      </section>
      <RecentSessions />
      <NewTask team={doc} name={teamName} startTask={task} focusVersion={focusVersion} />
      <Tools />
      <section className="local-panel local-recent-teams" aria-labelledby="local-recent-teams-heading">
        <header className="local-section-head"><h2 id="local-recent-teams-heading">{t("recentlyEdited")}</h2><Link to="/teams">{t("manage")}<IconChevronRight aria-hidden /></Link></header>
        {teams.length ? <div>{teams.slice(0, 3).map(team => <button type="button" className="local-recent-team" key={team.id}
          aria-label={`${t("useTeam")} · ${label(team.name, teamDocOf(team, box)).text}`} onClick={() => setActive({ id: team.id, format: team.format })}>
          <span><strong>{label(team.name, teamDocOf(team, box)).text}</strong><small>{st(`format.${team.format}`)} · {formatDay(team.updatedAt, lang)}</small></span>
          <IconArrowRight size={17} aria-hidden /></button>)}</div> : <p className="local-muted">{t("emptyRecent")}</p>}
      </section>
      <section className="local-panel local-environment" aria-labelledby="local-env-heading">
        <header className="local-section-head"><h2 id="local-env-heading">{t("environment")}</h2><span className="local-date num">{asOf}</span></header>
        <Link to="/ranking"><strong>{t("official")}</strong><span>{t("officialBody")}</span><IconChevronRight aria-hidden /></Link>
        <Link to="/ranking?src=top"><strong>{t("competitive")}</strong><span>{t("competitiveBody")}</span><IconChevronRight aria-hidden /></Link>
      </section>
    </div>
    <details className="local-help"><summary>{t("help")}</summary><p>{t("helpBody")}</p><Link to="/teams">{t("manage")}<IconArrowRight size={16} aria-hidden /></Link></details>
  </div>;
}
