/** The home page's drawings. They are layout illustrations, not results: no damage, usage or
 * inferred set on them is presented as data, and none needs a data request or a sprite. Their colours
 * come from the site's own data language: the matchup grid's KO ramp and the type colours. */
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { IconChevronsDown, IconChevronsUp } from "@tabler/icons-react";
import { typeColor, typeIconUrl } from "../../assets/icons.ts";
import { typeLabel } from "../../components/TypeBadge.tsx";
import { useLang, useT } from "../../i18n.ts";
import { koLabel } from "../../lib/ko.ts";
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
/** The KO buckets of the matchup grid, weighted roughly the way a real top-of-the-meta table reads. */
const BUCKETS: Array<[string, number]> = [
  ["ko-ohko", 22], ["ko-2hko", 34], ["ko-3hko", 16], ["ko-4hko", 10], ["ko-slow", 9], ["ko-ohkoG", 5],
  ["ko-immune", 4],
];
const HEAD_TYPES = ["Dragon", "Water", "Steel", "Ground", "Fairy", "Fire", "Grass", "Dark", "Electric",
  "Ghost", "Fighting", "Psychic", "Flying", "Poison", "Ice", "Bug", "Rock", "Normal", "Fire"];

/** A fixed pattern (same every visit): a seeded generator, not data. */
function mosaic(): string[] {
  let seed = 20261011;
  const next = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const total = BUCKETS.reduce((sum, [, w]) => sum + w, 0);
  return Array.from({ length: COLS * ROWS }, () => {
    let roll = next() * total;
    for (const [cls, weight] of BUCKETS) {
      roll -= weight;
      if (roll <= 0) return cls;
    }
    return "ko-2hko";
  });
}
const CELLS = mosaic();

const rowType = (r: number) => HEAD_TYPES[(r + 5) % HEAD_TYPES.length]!;

function Mosaic({ picked, onPick }: { picked: Picked | null; onPick: (event: MouseEvent<HTMLDivElement>) => void }) {
  return (
    <div className="home-mosaic-grid" aria-hidden="true" onClick={onPick}>
      <span className="home-mosaic-corner" />
      {HEAD_TYPES.slice(0, COLS).map((type, i) => (
        <span key={`c${i}`} className="home-mosaic-head" data-c={i} style={{ "--tc": typeColor(type) } as CSSProperties} />
      ))}
      {Array.from({ length: ROWS }, (_, r) => [
        <span key={`r${r}`} className="home-mosaic-head row" data-r={r}
          style={{ "--tc": typeColor(rowType(r)) } as CSSProperties} />,
        ...CELLS.slice(r * COLS, (r + 1) * COLS).map((cls, c) => (
          <span key={`${r}-${c}`} data-r={r} data-c={c} style={{ "--i": r + c } as CSSProperties}
            className={`home-mosaic-cell ${cls}${picked?.r === r && picked.c === c ? " on" : ""}`} />
        )),
      ])}
    </div>
  );
}

interface Picked { r: number; c: number; bucket: string; x: number; y: number; side: "left" | "right" }

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
const ORDER = BUCKETS.map(([cls]) => cls);

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

function Direction({ label, type, bucket, hp }: { label: string; type: string; bucket: string; hp?: boolean }) {
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
          {icon ? <img src={icon} alt="" /> : null}{t("home.pop.move").replace("{type}", typeLabel(type, lang))}
        </span>
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

/** A clicked cell read out the way the matchup grid's inspector reads one: the two sets (the table's
 * rows and columns are the metagame in rank order), who moves first, and both directions with their
 * best move, KO turns and damage band. It floats over the art and never moves the page. */
function MatchPop({ picked }: { picked: Picked }) {
  const t = useT();
  const attacker = rowType(picked.r);
  const defender = HEAD_TYPES[picked.c]!;
  // The reply is the mirrored cell where the table has one, a fixed pick from the ramp where not.
  const reply = picked.c < ROWS && picked.r < COLS
    ? CELLS[picked.c * COLS + picked.r]!
    : ORDER[(picked.r * 3 + picked.c * 5) % ORDER.length]!;
  const first = (picked.r * 7 + picked.c * 3) % 2 === 0;
  return (
    <div className={`home-pop ${picked.side}`} style={{ "--x": `${picked.x}px`, "--y": `${picked.y}px` } as CSSProperties}>
      <div className="home-pop-head">
        <Side type={attacker} rank={picked.r + 1} />
        <span className="home-pop-vs">{t("home.pop.vs")}</span>
        <Side type={defender} rank={picked.c + 1} />
        <span className={`home-pop-speed${first ? " first" : ""}`}>
          {first ? <IconChevronsUp aria-hidden="true" /> : <IconChevronsDown aria-hidden="true" />}
          {t(first ? "home.pop.first" : "home.pop.second")}
        </span>
      </div>
      <Direction label={t("home.pop.attack")} type={attacker} bucket={picked.bucket} hp />
      <Direction label={t("home.pop.reply")} type={defender} bucket={reply} />
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
    const bucket = [...cell.classList].find((name) => name.startsWith("ko-")) ?? "ko-2hko";
    setPicked({ r, c, bucket, x: Math.round(x), y: Math.round(y), side });
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
