/** A home section's heading: a small mark drawn in the section's own visual language, the title, and
 * a hairline running to the edge. The marks are decoration: the metagame grid's KO ramp for the
 * calculators, a rank ladder in type colours for the metagame glance, the logo's charged core for the
 * install pitch. */
import type { CSSProperties } from "react";
import { typeColor } from "../../assets/icons.ts";
import { Phrases } from "./Phrases.tsx";

export type SectionMarkKind = "lab" | "glance" | "core";

const LAB = ["ko-ohko", "ko-2hko", "ko-3hko", "ko-slow"];
const GLANCE = ["Dragon", "Water", "Steel"];

export function SectionMark({ kind }: { kind: SectionMarkKind }) {
  return (
    <span className={`home-section-mark ${kind}`} aria-hidden="true">
      {kind === "lab" && LAB.map((cls) => <i key={cls} className={cls} />)}
      {kind === "glance" && GLANCE.map((type) => <i key={type} style={{ "--tc": typeColor(type) } as CSSProperties} />)}
      {kind === "core" && <i />}
    </span>
  );
}

export function SectionHead({ id, title, mark }: { id: string; title: string; mark: SectionMarkKind }) {
  return (
    <header className="home-section-head">
      <SectionMark kind={mark} />
      <h2 id={id}><Phrases text={title} /></h2>
      <span className="home-section-rule" aria-hidden="true" />
    </header>
  );
}
