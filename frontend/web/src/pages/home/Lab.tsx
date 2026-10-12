/** The computed tools that set the site apart, each with a small schematic of what its screen shows
 * and a link straight into it. The schematics are drawings of the layout, not results. */
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useT, type MsgKey } from "../../i18n.ts";
import { useRuntime } from "../../runtime/context.tsx";
import { releasePointer, trackPointer } from "./pointer.ts";
import { CalcArt, MatrixArt } from "./WorkbenchArt.tsx";

function TuneArt() {
  // A survival curve over SP: flat, then the cliff where the hit stops KOing.
  return (
    <svg className="home-art-tune" viewBox="0 0 200 92" aria-hidden="true">
      <path className="grid" d="M10 80 H190 M10 52 H190 M10 24 H190" />
      <path className="area" d="M86 30 H190 V86 H86 Z" />
      <path className="curve" d="M10 76 H86 V30 H190" />
      <path className="cliff" d="M86 12 V86" />
      <circle className="dot" cx="86" cy="30" r="5" />
    </svg>
  );
}

const INFER = [78, 46, 22, 9];
function InferArt() {
  return (
    <div className="home-art-infer" aria-hidden="true">
      {INFER.map((w, i) => (
        <span key={i} className={i === 3 ? "out" : undefined} style={{ "--w": `${w}%`, "--n": i } as CSSProperties} />
      ))}
    </div>
  );
}

interface Tile {
  id: string;
  title: MsgKey;
  body: MsgKey;
  art: ReactNode;
  links: Array<{ to: string; label: MsgKey }>;
}

export function Lab() {
  const t = useT();
  const { can } = useRuntime();
  const tiles: Tile[] = [
    ...(can("calc.damage") || can("calc.speedline") ? [{
      id: "calc", title: "home.lab.calc.title", body: "home.lab.calc.body", art: <CalcArt all />,
      links: [
        ...(can("calc.damage") ? [{ to: "/calc", label: "home.lab.calc.damage" as MsgKey }] : []),
        ...(can("calc.speedline") ? [{ to: "/calc?tab=speed", label: "home.lab.calc.speed" as MsgKey }] : []),
      ],
    } as Tile] : []),
    ...(can("team.matchup") ? [{
      id: "matrix", title: "home.lab.matrix.title", body: "home.lab.matrix.body", art: <MatrixArt />,
      links: [{ to: "/matchup", label: "home.lab.matrix.ko" }, { to: "/matchup?mode=actual", label: "home.lab.matrix.actual" }],
    } as Tile] : []),
    ...(can("calc.damage") ? [{
      id: "tune", title: "home.lab.tune.title", body: "home.lab.tune.body", art: <TuneArt />,
      links: [{ to: "/calc?tab=tune", label: "home.lab.tune.go" }],
    } as Tile, {
      id: "infer", title: "home.lab.infer.title", body: "home.lab.infer.body", art: <InferArt />,
      links: [{ to: "/calc?tab=infer", label: "home.lab.infer.go" }],
    } as Tile] : []),
  ];
  if (!tiles.length) return null;
  return (
    <section className="home-lab" aria-labelledby="home-lab-heading">
      <header className="home-section-head">
        <h2 id="home-lab-heading">{t("home.lab.title")}</h2>
      </header>
      <div className="home-lab-grid">
        {tiles.map((tile) => (
          <article key={tile.id} className={`home-lab-tile ${tile.id}`} onPointerMove={trackPointer} onPointerLeave={releasePointer}>
            <div className="home-lab-art">{tile.art}</div>
            <div className="home-lab-text">
              <h3>{t(tile.title)}</h3>
              <p>{t(tile.body)}</p>
              <div className="home-lab-links">
                {tile.links.map((link) => <Link key={link.to} to={link.to}>{t(link.label)}</Link>)}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
