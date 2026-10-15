/** The metagame source controls shared by the ranking and detail pages: official data or Top Meta,
 * the Top Meta scope, the comparison toggle, and the one floating note that says who Top Meta is and
 * how the comparison reads. The state lives in the URL (lib/metaView.ts), so a link or a reload
 * opens the same view. Each page places the pieces in its own header row. */
import type { TopMetaScopeId } from "@pokemon-champions/protocol";
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useTopT } from "./metaMessages.ts";
import { readMetaView, withMetaView, type MetaSource, type MetaView } from "../lib/metaView.ts";
import { useRuntime } from "../runtime/context.tsx";
import { useEscapeLayer } from "./EscapeLayers.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";
import { useAnchoredPopover } from "./useAnchoredPopover.ts";
import "./styles.metasource.css";

function useMetaView(): [MetaView, (next: Partial<MetaView>, extra?: (p: URLSearchParams) => void) => void] {
  const [params, setParams] = useSearchParams();
  const set = (next: Partial<MetaView>, extra?: (p: URLSearchParams) => void) => {
    const updated = withMetaView(params, next);
    extra?.(updated);
    setParams(updated, { replace: true });
  };
  return [readMetaView(params), set];
}

/** 官方数据 | 竞技环境. `onSource` lets a page clear state that only one source has (the trend view). */
export function SourceSwitch({ onSource, className = "" }: {
  onSource?: (source: MetaSource, params: URLSearchParams) => void;
  className?: string;
}) {
  const [view, set] = useMetaView();
  const t = useTopT();
  return (
    <SegmentedControl<MetaSource> kind="radio" value={view.source} ariaLabel={t("top.source")}
      className={`seg meta-src-seg ${className}`}
      onChange={(source) => set({ source }, onSource ? (p) => onSource(source, p) : undefined)}
      items={[{ id: "ingame", label: t("top.source.ingame") }, { id: "top", label: t("top.source.top") }]} />
  );
}

/** Live season and regulation identifiers, shown only while Top Meta is on screen. */
export function ScopeSwitch({ className = "" }: { className?: string }) {
  const [view, set] = useMetaView();
  const t = useTopT();
  const { capabilities: { environment } } = useRuntime();
  return (
    <SegmentedControl<TopMetaScopeId> kind="radio" value={view.scope} ariaLabel={t("top.scope")}
      className={`seg meta-src-seg ${className}`} onChange={(scope) => set({ scope })}
      items={[{ id: "season", label: environment.season }, { id: "rule", label: environment.rule }]} />
  );
}

/** The floating note. Portalled to the body and placed against the viewport (the same pattern as the
 * item-lock tip), so no card, sticky header or clipped container can sit over it, and it never runs
 * off-screen. Hover or focus shows it; a click pins it for touch screens; Escape or leaving closes. */
function InfoTip({ text, label, align }: { text: string; label: string; align: "start" | "end" }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLSpanElement>(null);
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const position = useAnchoredPopover(open, anchor, popup,
    { minWidth: 320, matchAnchor: false, align, maxHeight: 420 });
  useEscapeLayer(open, () => { setHovered(false); setPinned(false); }, 40);
  return (
    <>
      <button ref={anchor} type="button" className="meta-src-info" aria-label={label}
              aria-describedby={id} aria-expanded={open}
              onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
              onFocus={() => setHovered(true)} onBlur={() => { setHovered(false); setPinned(false); }}
              onClick={() => setPinned((v) => !v)}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" /><path d="M8 7.2v4M8 4.6v.4" />
        </svg>
      </button>
      {createPortal(
        <span ref={popup} id={id} role={open ? "tooltip" : undefined}
              className={open ? "meta-src-tip" : "sr-only"} style={open ? position : undefined}>
          {text}
        </span>, document.body)}
    </>
  );
}

/** The comparison toggle sits directly after the source-specific options. */
export function CompareToggle() {
  const [view, set] = useMetaView();
  const t = useTopT();
  return (
    <button type="button" className="meta-chip meta-compare-toggle" aria-pressed={view.compare}
            onClick={() => set({ compare: !view.compare })}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h9m-2.5-2.5L12 5 9.5 7.5M13 11H4m2.5 2.5L4 11l2.5-2.5" /></svg>
      {t("top.compare")}
      <span className="meta-chip-track" aria-hidden="true"><i /></span>
    </button>
  );
}

/** Source and sample explanations stay at the right edge of either page's controls. */
function MetaInfo() {
  const t = useTopT();
  return <InfoTip text={t("top.about")} label={t("top.aboutLabel")} align="end" />;
}

/** The Top Meta sample line. While the regulation scope compares, it also says what it is compared
 * with: the current official data, which covers a shorter time range than the regulation pool. */
function TopSample({ sample }: { sample: { teams: number; sets: number } }) {
  const t = useTopT();
  const [view] = useMetaView();
  const text = t("top.sample").replace("{teams}", sample.teams.toLocaleString())
    .replace("{sets}", sample.sets.toLocaleString());
  return (
    <span className="meta-src-sample">
      {view.source === "top" && view.scope === "rule" && view.compare ? `${text} · ${t("top.vsCurrent")}` : text}
    </span>
  );
}

export function MetaNotes({ sample, className = "" }: {
  sample?: { teams: number; sets: number };
  className?: string;
}) {
  return <div className={`meta-source-notes ${className}`.trim()}>
    {sample && <TopSample sample={sample} />}
    <MetaInfo />
  </div>;
}
