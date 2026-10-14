/** The home page's drawings. They are layout illustrations, not results: no damage, usage or
 * inferred set on them is presented as data, and none needs a data request or a sprite. Their colours
 * come from the site's own data language: the matchup grid's KO ramp and the type colours. */
import type { TypeName } from "@pokemon-champions/protocol";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { IconChevronsDown, IconChevronsUp } from "@tabler/icons-react";
import { typeColor, typeIconUrl } from "../../assets/icons.ts";
import { typeLabel } from "../../components/TypeBadge.tsx";
import { useLang, useT } from "../../i18n.ts";
import { koLabel } from "../../lib/ko.ts";
import { multiplier } from "../../lib/typechart.ts";
import { releasePointer, trackPointer } from "./pointer.ts";

/** Two illustrative sides, one plausible type colour per member. */
const SIDES = {
  ours: ["Fire", "Ground", "Water", "Normal", "Fairy", "Dark"],
  theirs: ["Grass", "Dragon", "Steel", "Electric", "Ghost", "Fighting"],
};

export function TeamDots({ side = "ours" }: { side?: keyof typeof SIDES }) {
  return (
    <span className="home-art-team" aria-hidden="true">
      {SIDES[side].map((type, i) => (
        <i key={i} style={{ "--mon": typeColor(type), "--n": side === "ours" ? i : i + 6 } as CSSProperties} />
      ))}
    </span>
  );
}

/** Speed order along one track: whose turn comes first, with one of ours highlighted. */
const SPEED: Array<[number, "us" | "them" | "me"]> = [[6, "them"], [21, "us"], [37, "them"], [52, "me"], [70, "them"], [88, "us"]];

/** The calculator's "all matchups" table, drawn the way that page draws it: our attackers across the
 * top, each spanning its moves; their members down the side; a cell per move per defender. */
const ATTACKERS = 3;
const MOVES = 2;
const DEFENDERS = 4;
const ALL = [
  "2hko", "3hko", "ohko", "2hko", "3hko", "4hko",
  "ohko", "2hko", "3hko", "slow", "2hko", "2hko",
  "3hko", "immune", "2hko", "ohkoG", "4hko", "3hko",
  "2hko", "3hko", "slow", "2hko", "ohko", "2hko",
];
const ALL_PICK = 9;

function AllGrid() {
  const t = useT();
  return (
    <div className="home-art-all">
      <em className="home-art-all-title">{t("home.art.all")}</em>
      <div className="home-art-all-grid">
        <span />
        {SIDES.ours.slice(0, ATTACKERS).map((type, a) => (
          <span key={`a${a}`} className="grp" style={{ "--mon": typeColor(type) } as CSSProperties}><i /><b /></span>
        ))}
        <span />
        {Array.from({ length: ATTACKERS * MOVES }, (_, m) => <span key={`m${m}`} className="mv"><b /></span>)}
        {SIDES.theirs.slice(0, DEFENDERS).map((type, r) => [
          <span key={`d${r}`} className="rh" style={{ "--mon": typeColor(type) } as CSSProperties}><i /><b /></span>,
          ...ALL.slice(r * 6, r * 6 + 6).map((bucket, c) => (
            <span key={`${r}-${c}`} className={`cell ko-${bucket}${r * 6 + c === ALL_PICK ? " on" : ""}`}
              style={{ "--d": r + c } as CSSProperties}><b /><i /></span>
          )),
        ])}
      </div>
    </div>
  );
}

export function CalcArt({ all = false }: { all?: boolean }) {
  const t = useT();
  return (
    <div className={`home-art-calc${all ? " with-all" : ""}`} aria-hidden="true">
      <div className="home-art-calc-main">
        <div className="home-art-sides">
          <span><em>{t("home.art.ours")}</em><TeamDots /></span>
          <span><em>{t("home.art.theirs")}</em><TeamDots side="theirs" /></span>
        </div>
        <div className="home-art-row">
          <em>{t("home.art.damage")}</em>
          <span className="home-art-damage"><b /><i /></span>
        </div>
        <div className="home-art-row">
          <em>{t("home.art.speed")}</em>
          <span className="home-art-speed">
            {SPEED.map(([x, who], i) => <b key={x} className={who} style={{ "--x": `${x}%`, "--n": i } as CSSProperties} />)}
          </span>
        </div>
      </div>
      {all && <AllGrid />}
    </div>
  );
}

const MATRIX = ["2hko", "ohko", "3hko", "2hko", "immune", "ohko", "3hko", "2hko", "slow", "ohko", "2hko", "3hko",
  "ohko", "2hko", "3hko", "immune", "2hko", "ohko", "2hko", "slow", "ohko", "2hko", "3hko", "2hko"];
const MATRIX_COLS = 6;
const PICK = 9;
/** Hovered, the table looks one cell up: its row and column stay lit, the rest falls back. */
export function MatrixArt() {
  return (
    <div className="home-art-matrix" aria-hidden="true">
      {MATRIX.map((bucket, i) => {
        const r = Math.floor(i / MATRIX_COLS);
        const c = i % MATRIX_COLS;
        const cross = r === Math.floor(PICK / MATRIX_COLS) || c === PICK % MATRIX_COLS;
        return <i key={i} className={`ko-${bucket}${i === PICK ? " pick" : cross ? " cross" : ""}`}
          style={{ "--d": r + c } as CSSProperties} />;
      })}
    </div>
  );
}

const COLS = 11;
const ROWS = 8;
/** The metagame's top eleven in rank order, one plausible type each. They head the columns, and the
 * first eight head the rows again: the same members on both axes, as in the real matchup grid. */
const RANKED: TypeName[] = ["Dragon", "Water", "Steel", "Ground", "Fairy", "Fire", "Grass", "Dark", "Electric",
  "Ghost", "Fighting"];

/** Plausible KO buckets for a STAB hit at each type multiplier, weighted. The type chart decides the
 * multiplier, so "no effect" appears exactly where the chart says it does. */
const BY_MULT: Array<[number, Array<[string, number]>]> = [
  [4, [["ko-ohkoG", 2], ["ko-ohko", 1]]],
  [2, [["ko-ohko", 6], ["ko-ohkoG", 2], ["ko-2hko", 2]]],
  [1, [["ko-2hko", 6], ["ko-3hko", 3], ["ko-ohko", 1.5]]],
  [0.5, [["ko-3hko", 4], ["ko-4hko", 3.5], ["ko-slow", 2.5]]],
  [0.25, [["ko-slow", 1]]],
  [0, [["ko-immune", 1]]],
];

/** Rank `a`'s STAB into rank `d`: the chart's multiplier and a bucket picked by a fixed roll per pair
 * (same every visit; a drawing, not a calculation). */
function hit(a: number, d: number): { mult: number; bucket: string } {
  const mult = multiplier(RANKED[a]!, [RANKED[d]!]);
  const weights = BY_MULT.find(([m]) => m === mult)?.[1] ?? BY_MULT[2]![1];
  let seed = (20261014 + a * 7919 + d * 104729) & 0x7fffffff;
  for (let i = 0; i < 3; i++) seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  let roll = (seed / 0x7fffffff) * weights.reduce((sum, [, w]) => sum + w, 0);
  for (const [bucket, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return { mult, bucket };
  }
  return { mult, bucket: weights[0]![0] };
}

/** Every pair's hit, once: the table and its read-out both look them up. */
const HITS = RANKED.map((_, a) => RANKED.map((_, d) => hit(a, d)));

/** The hovered cell's row and column go on the grid as attributes, set without a re-render. */
function hover(event: ReactPointerEvent<HTMLDivElement>) {
  const grid = event.currentTarget;
  const cell = (event.target as HTMLElement).closest<HTMLElement>(".home-mosaic-cell");
  if (cell) {
    grid.dataset.hr = cell.dataset.r;
    grid.dataset.hc = cell.dataset.c;
  } else {
    delete grid.dataset.hr;
    delete grid.dataset.hc;
  }
}
function unhover(event: ReactPointerEvent<HTMLDivElement>) {
  delete event.currentTarget.dataset.hr;
  delete event.currentTarget.dataset.hc;
}

function Mosaic({ picked, onPick }: { picked: Picked | null; onPick: (event: MouseEvent<HTMLDivElement>) => void }) {
  return (
    <div className="home-mosaic-grid" aria-hidden="true" onClick={onPick} onPointerOver={hover} onPointerLeave={unhover}
      data-pr={picked?.r} data-pc={picked?.c}>
      <span className="home-mosaic-corner" />
      {RANKED.slice(0, COLS).map((type, i) => (
        <span key={`c${i}`} className="home-mosaic-head" data-c={i} style={{ "--tc": typeColor(type) } as CSSProperties} />
      ))}
      {Array.from({ length: ROWS }, (_, r) => [
        <span key={`r${r}`} className="home-mosaic-head row" data-r={r}
          style={{ "--tc": typeColor(RANKED[r]!) } as CSSProperties} />,
        ...Array.from({ length: COLS }, (_, c) => (
          <span key={`${r}-${c}`} data-r={r} data-c={c} style={{ "--i": r + c } as CSSProperties}
            className={`home-mosaic-cell ${HITS[r]![c]!.bucket}${picked?.r === r && picked.c === c ? " on" : ""}`} />
        )),
      ])}
    </div>
  );
}

interface Picked { r: number; c: number; x: number; y: number; side: "left" | "right" }

/** Turns to KO and whether the worst roll still makes it, per KO bucket (immune has none). */
const BUCKET_HITS: Record<string, [number, boolean]> = {
  "ko-ohkoG": [1, true], "ko-ohko": [1, false], "ko-2hko": [2, true], "ko-3hko": [3, true],
  "ko-4hko": [4, true], "ko-slow": [5, true],
};
/** Where each bucket's damage band sits on the defender's HP (percent): a drawing of the band, not a roll. */
const BUCKET_BAND: Record<string, [number, number]> = {
  "ko-ohkoG": [100, 100], "ko-ohko": [84, 100], "ko-2hko": [52, 63], "ko-3hko": [35, 44],
  "ko-4hko": [26, 31], "ko-slow": [12, 17], "ko-immune": [0, 0],
};

function Side({ type, rank }: { type: string; rank: number }) {
  const t = useT();
  const icon = typeIconUrl(type);
  return (
    <span className="home-pop-side" style={{ "--tc": typeColor(type) } as CSSProperties}>
      <span className="home-pop-avatar">{icon ? <img src={icon} alt="" /> : null}</span>
      <span className="home-pop-rank num">{t("home.pop.rank").replace("{n}", String(rank))}</span>
    </span>
  );
}

/** One direction: the attacker's STAB (type, multiplier), its KO turns and the damage band. */
function Direction({ label, type, mult, bucket, hp }: { label: string; type: string; mult: number; bucket: string; hp?: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const hits = BUCKET_HITS[bucket];
  const ko = hits ? `${koLabel(hits[0], true, hits[1], lang)}${bucket === "ko-slow" ? "+" : ""}` : t("home.art.immune");
  const [lo, hi] = BUCKET_BAND[bucket] ?? [40, 50];
  const icon = typeIconUrl(type);
  const segments = hits ? hits[0] : 1;
  return (
    <div className="home-pop-dir">
      <div className="home-pop-line">
        <span className="home-pop-dir-label">{label}</span>
        <span className="home-pop-move" style={{ "--tc": typeColor(type) } as CSSProperties}>
          {icon ? <img src={icon} alt="" /> : null}{typeLabel(type, lang)}
        </span>
        <span className="home-pop-stab">{t("home.pop.stab")}</span>
        <span className={`home-pop-mult num${mult > 1 ? " up" : mult < 1 ? " down" : ""}`}>×{mult}</span>
        <span className={`home-pop-ko ${bucket}`}>{ko}</span>
      </div>
      <div className="home-pop-band" style={{ "--lo": `${lo}%`, "--hi": `${hi}%` } as CSSProperties}>
        <b className={bucket} /><i className={bucket} />
      </div>
      {hp && (
        <div className={`home-pop-hp${hits ? "" : " held"}`}>
          {Array.from({ length: segments }, (_, i) => <i key={i} style={{ "--n": segments - 1 - i } as CSSProperties} />)}
        </div>
      )}
    </div>
  );
}

/** A clicked cell read out the way the matchup grid's inspector reads one: the two members (the
 * table's rows and columns are the metagame in rank order), who moves first, and both directions —
 * each side's STAB with its type multiplier, KO turns and damage band. A member against itself is a
 * speed tie. It floats over the art and never moves the page. */
function MatchPop({ picked }: { picked: Picked }) {
  const t = useT();
  const { r, c } = picked;
  const deals = HITS[r]![c]!;
  const takes = HITS[c]![r]!;
  const speed = r === c ? "tie" : (r * 7 + c * 3) % 2 === 0 ? "first" : "second";
  return (
    <div className={`home-pop ${picked.side}`} style={{ "--x": `${picked.x}px`, "--y": `${picked.y}px` } as CSSProperties}>
      <div className="home-pop-head">
        <Side type={RANKED[r]!} rank={r + 1} />
        <span className="home-pop-vs">{t("home.pop.vs")}</span>
        <Side type={RANKED[c]!} rank={c + 1} />
        <span className={`home-pop-speed ${speed}`}>
          {speed === "first" ? <IconChevronsUp aria-hidden="true" /> : speed === "second" ? <IconChevronsDown aria-hidden="true" /> : null}
          {t(`home.pop.${speed}`)}
        </span>
      </div>
      <Direction label={t("home.pop.deals")} type={RANKED[r]!} mult={deals.mult} bucket={deals.bucket} hp />
      <Direction label={t("home.pop.takes")} type={RANKED[c]!} mult={takes.mult} bucket={takes.bucket} />
    </div>
  );
}

/** The stage art, decorative only: the metagame's KO table, with the two-team calculator floating in
 * front of it. The table leans toward the pointer and the card drifts against it (a light parallax);
 * a hovered cell lights its row and column the way the real matchup grid does, and a clicked one
 * opens its result beside it. */
export function WorkbenchArt() {
  const t = useT();
  const art = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);

  useEffect(() => {
    if (!picked) return;
    const outside = (event: PointerEvent) => {
      if (!(event.target as Element).closest?.(".home-mosaic-cell, .home-pop")) setPicked(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setPicked(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [picked]);

  const pick = (event: MouseEvent<HTMLDivElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>(".home-mosaic-cell");
    const frame = art.current?.getBoundingClientRect();
    if (!cell || !frame) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    if (picked?.r === r && picked.c === c) { setPicked(null); return; }
    const box = cell.getBoundingClientRect();
    // Open toward the table's middle, so the card stays over the art; keep it inside vertically.
    const side = box.left + box.width / 2 - frame.left > frame.width / 2 ? "left" : "right";
    const y = Math.min(Math.max(box.top + box.height / 2 - frame.top, 96), frame.height - 96);
    const x = side === "left" ? box.left - frame.left - 10 : box.right - frame.left + 10;
    setPicked({ r, c, x: Math.round(x), y: Math.round(y), side });
  };

  return (
    <div ref={art} className="home-art" aria-hidden="true" onPointerMove={trackPointer} onPointerLeave={releasePointer}>
      <Mosaic picked={picked} onPick={pick} />
      {picked && <MatchPop key={`${picked.r}-${picked.c}`} picked={picked} />}
      <div className="home-art-card">
        <div className="home-art-card-head">
          <span>{t("home.lab.calc.title")}</span>
          <span className="home-art-tag">{t("home.art.sets")}</span>
        </div>
        <CalcArt />
      </div>
    </div>
  );
}
