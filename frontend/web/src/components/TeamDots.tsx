/** A team at a glance: a dot per member in its type colours (a dual type split down the middle). Used
 * where a run record names its team — the assist strips, the matchup history. */
import type { CSSProperties } from "react";
import { typeColor } from "../assets/icons.ts";
import { GameImage } from "./GameImage.tsx";
import { slugify } from "./team/MonChip.tsx";
import { displayName, useLang } from "../i18n.ts";
import { useDexByName } from "../hooks.ts";

export function TeamDots({ species }: { species: string[] }) {
  const dex = useDexByName();
  if (!species.length) return null;
  return (
    <span className="aw-dots" aria-hidden="true">
      {species.slice(0, 6).map((name, i) => {
        const [first, second] = dex.get(name)?.types ?? [];
        const one = first ? typeColor(first) : "var(--line-strong)";
        return <i key={`${name}-${i}`} style={{ "--t1": one, "--t2": second ? typeColor(second) : one } as CSSProperties} />;
      })}
    </span>
  );
}


/** A team as its six faces (empty places stay as outlines), for a record card. */
export function TeamSprites({ species }: { species: string[] }) {
  const dex = useDexByName();
  const { lang } = useLang();
  return (
    <span className="aw-sprites" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => {
        const name = species[i];
        if (!name) return <i key={i} className="empty" />;
        const entry = dex.get(name);
        return (
          <i key={i} title={entry ? displayName(entry, lang) : name}>
            <GameImage assetKey={`pokemon:${entry?.slug ?? slugify(name)}`} role="dense" alt="" />
          </i>
        );
      })}
    </span>
  );
}
