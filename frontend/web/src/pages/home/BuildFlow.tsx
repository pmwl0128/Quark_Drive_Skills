/** The builder's six gates as a flow map, laid out as two rows of three: the reader's brief enters
 * at the top left, runs right through the first three gates, turns at the right edge and comes back
 * along the second row to a recommended team at the bottom left. The data the gates read (real
 * teams, usage, damage calcs) streams in from above and below. Particles keep moving along the
 * lines and the gates light in turn, with the lit gate named underneath. Drawn, not measured:
 * nothing here is a result.
 *
 * Particles ride the SVG paths (SMIL `animateMotion`, so they scale with the drawing); the labels are
 * HTML placed at the same coordinates, so they stay crisp at any width. */
import "../../styles.flow.css";
import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import {
  IconClipboardCheck, IconDatabase, IconShieldCheck, IconSitemap, IconSparkles, IconSwords,
} from "@tabler/icons-react";
import { typeColor } from "../../assets/icons.ts";
import { useT, type MsgKey } from "../../i18n.ts";

const W = 600;
const H = 330;
const TOP = 110;
const BOTTOM = 226;
const COLS = [190, 340, 490];
/** The turn at the right edge: a half circle between the two rows. */
const TURN_X = 524;
const TURN_R = (BOTTOM - TOP) / 2;

type Gate = { id: string; x: number; y: number; Icon: ComponentType<{ "aria-hidden"?: boolean | "true" }> };
const GATES: Gate[] = [
  { id: "context", x: COLS[0]!, y: TOP, Icon: IconClipboardCheck },
  { id: "frame", x: COLS[1]!, y: TOP, Icon: IconSitemap },
  { id: "ground", x: COLS[2]!, y: TOP, Icon: IconDatabase },
  { id: "generate", x: COLS[2]!, y: BOTTOM, Icon: IconSparkles },
  { id: "evaluate", x: COLS[1]!, y: BOTTOM, Icon: IconSwords },
  { id: "audit", x: COLS[0]!, y: BOTTOM, Icon: IconShieldCheck },
];
const IN = { x: 70, y: TOP };
const OUT = { x: 74, y: BOTTOM };

/** Where each data source sits and the gate it feeds (the gates' real reads: frame from real teams,
 * ground from usage, evaluate from damage calcs). Colours are theme tokens (styles.home.css). */
const SOURCES: Array<{ key: MsgKey; x: number; y: number; to: number; color: string }> = [
  { key: "home.qa.src.real", x: 290, y: 28, to: 1, color: "var(--flow-a)" },
  { key: "home.qa.src.ranking", x: 440, y: 28, to: 2, color: "var(--flow-b)" },
  { key: "home.qa.src.damage", x: 290, y: 304, to: 4, color: "var(--flow-c)" },
];

const MAIN = [
  `M${IN.x} ${TOP}`,
  `H${TURN_X}`,
  `A${TURN_R} ${TURN_R} 0 0 1 ${TURN_X} ${BOTTOM}`,
  `H${OUT.x}`,
].join(" ");
/** A gentle S from the source onto its gate, vertical at both ends. */
const feeder = (x: number, y: number, gate: Gate) => {
  const down = gate.y > y;
  const from = down ? y + 12 : y - 12;
  const to = down ? gate.y - 19 : gate.y + 19;
  const mid = (from + to) / 2;
  return `M${x} ${from} C${x} ${mid} ${gate.x} ${mid} ${gate.x} ${to}`;
};

const at = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }) as CSSProperties;
const TEAM = ["Fire", "Ground", "Water", "Normal", "Fairy", "Dark"];
const STEP_MS = 1100;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return reduced;
}

export function BuildFlow({ running }: { running: boolean }) {
  const t = useT();
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(() => !document.hidden);
  useEffect(() => {
    const change = () => setForeground(!document.hidden);
    document.addEventListener("visibilitychange", change);
    const observer = typeof IntersectionObserver === "undefined" ? null
      : new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)));
    if (root.current && observer) observer.observe(root.current);
    else setVisible(true);
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", change); };
  }, []);
  const live = running && !reduced && visible && foreground;
  // 0..5 = the gate being worked; 6 = the team delivered.
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setStep((s) => (s + 1) % (GATES.length + 1)), STEP_MS);
    return () => window.clearInterval(timer);
  }, [live]);
  const shown = live ? step : GATES.length;
  const gate = GATES[shown];

  return (
    <div ref={root} className={`home-flowmap${live ? " live" : ""}`}>
      <ol className="sr-only">
        {GATES.map((g) => <li key={g.id}>{t(`home.flow.${g.id}` as MsgKey)}: {t(`home.flow.${g.id}.d` as MsgKey)}</li>)}
      </ol>
      <div className="home-flowmap-canvas" aria-hidden="true">
        <svg className="home-flowmap-lines" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {SOURCES.map((s) => (
            <g key={s.key} className="feed" style={{ "--c": s.color } as CSSProperties}>
              <path id={`home-feed-${s.to}`} className="track" d={feeder(s.x, s.y, GATES[s.to]!)} />
              <path className="stream" d={feeder(s.x, s.y, GATES[s.to]!)} />
            </g>
          ))}
          <path id="home-flow-main" className="track main" d={MAIN} />
          <path className="stream main" d={MAIN} />
          {live && (
            <>
              {Array.from({ length: 7 }, (_, i) => (
                <circle key={`m${i}`} className="particle" r={i % 2 ? 2.6 : 3.6}>
                  <animateMotion dur="7.7s" repeatCount="indefinite" begin={`${-i * 1.1}s`}>
                    <mpath href="#home-flow-main" />
                  </animateMotion>
                </circle>
              ))}
              {SOURCES.map((s, i) => (
                <circle key={s.key} className="particle feed" r={3} style={{ "--c": s.color } as CSSProperties}>
                  <animateMotion dur="2s" repeatCount="indefinite" begin={`${-i * 0.7}s`}>
                    <mpath href={`#home-feed-${s.to}`} />
                  </animateMotion>
                </circle>
              ))}
            </>
          )}
        </svg>
        <span className="home-fin" style={at(IN.x, IN.y)}>{t("home.flow.in")}</span>
        {SOURCES.map((s) => (
          <span key={s.key} className={`home-fsrc${live && GATES[s.to] === gate ? " on" : ""}`}
            style={{ ...at(s.x, s.y), "--c": s.color } as CSSProperties}>
            <i /><em>{t(s.key)}</em>
          </span>
        ))}
        {GATES.map((g, i) => (
          <span key={g.id} className={`home-fnode${i === shown ? " on" : i < shown ? " done" : ""}${g.y === BOTTOM ? " lower" : ""}`}
            style={at(g.x, g.y)}>
            <g.Icon aria-hidden="true" />
            <em>{t(`home.flow.${g.id}` as MsgKey)}</em>
          </span>
        ))}
        <span className={`home-fout${shown === GATES.length ? " on" : ""}`} style={at(OUT.x, OUT.y)}>
          <span className="home-fout-team">
            {TEAM.map((type, i) => <i key={i} style={{ "--mon": typeColor(type), "--n": i } as CSSProperties} />)}
          </span>
          <em>{t("home.flow.out")}</em>
        </span>
      </div>
      <p className="home-fcap" aria-hidden="true" key={shown}>
        {gate ? (
          <>
            <b className="num">{String(shown + 1).padStart(2, "0")}<small>/06</small></b>
            <span className="home-fcap-name">{t(`home.flow.${gate.id}` as MsgKey)}</span>
            <span className="home-fcap-desc">{t(`home.flow.${gate.id}.d` as MsgKey)}</span>
          </>
        ) : (
          <>
            <b className="num">06<small>/06</small></b>
            <span className="home-fcap-name">{t("home.flow.out")}</span>
            <span className="home-fcap-desc">{t("home.flow.audit.d")}</span>
          </>
        )}
      </p>
    </div>
  );
}
