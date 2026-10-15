import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

/** Long pickers keep the complete list and keyboard indices, mounting only the visible rows.
 * Measured heights preserve wrapped/localized labels instead of forcing every option to one line. */
export function ComboboxOptions<T extends { key: string }>({ options, active, popup, render }: {
  options: T[];
  active: number;
  popup: RefObject<HTMLDivElement | null>;
  render: (option: T, index: number) => ReactNode;
}) {
  const [heights, setHeights] = useState<Map<string, number>>(() => new Map());
  const [scrollTop, setScrollTop] = useState(() => Math.max(0, active * 44 - 80));
  const [viewportHeight, setViewportHeight] = useState(0);
  const rows = useRef<HTMLDivElement>(null);
  const offsets = useMemo(() => {
    const out = [0];
    for (const option of options) out.push(out[out.length - 1]! + (heights.get(option.key) ?? 44));
    return out;
  }, [options, heights]);
  const first = offsets.findIndex(offset => offset > scrollTop);
  const start = Math.max(0, (first < 0 ? options.length : first) - 5);
  const edge = scrollTop + (viewportHeight || 300);
  const last = offsets.findIndex(offset => offset > edge);
  const end = Math.min(options.length, (last < 0 ? options.length : last) + 5);

  useEffect(() => {
    const node = popup.current;
    if (!node) return;
    let frame: number | null = null;
    const sync = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => { frame = null; setScrollTop(node.scrollTop); });
    };
    node.addEventListener("scroll", sync, { passive: true });
    const resize = new ResizeObserver(() => setViewportHeight(node.clientHeight));
    resize.observe(node);
    return () => {
      node.removeEventListener("scroll", sync);
      resize.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [popup]);

  useLayoutEffect(() => {
    const measure = () => {
      const measured = Array.from(rows.current?.children ?? []).map(child => [
        (child as HTMLElement).dataset.optionKey!, child.getBoundingClientRect().height,
      ] as const);
      setHeights(current => {
        const changed = measured.filter(([key, height]) => height > 0 && current.get(key) !== height);
        return changed.length ? new Map([...current, ...changed]) : current;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (rows.current) observer.observe(rows.current);
    return () => observer.disconnect();
  }, [start, end, options]);

  // Only selection/filter changes reveal an index. Ordinary scrolling can leave the active row
  // offscreen; measuring another row must never pull the reader back to it.
  useLayoutEffect(() => {
    // Child layout effects precede the ancestor popup's ref attachment on the initial mount.
    const node = popup.current ?? rows.current?.closest<HTMLDivElement>("[role=listbox]");
    if (!node || !viewportHeight || active < 0 || active >= options.length) return;
    const top = offsets[active]!;
    const bottom = offsets[active + 1]!;
    const height = viewportHeight;
    const inset = 8; // Leave room for the popup's padding and border around the revealed row.
    if (top < node.scrollTop + inset) node.scrollTop = Math.max(0, top - inset);
    else if (bottom > node.scrollTop + height - inset) node.scrollTop = bottom - height + inset;
    setScrollTop(node.scrollTop);
  }, [active, options, popup, viewportHeight]);

  return <>
    <div aria-hidden style={{ height: offsets[start] }} />
    <div ref={rows} role="presentation">
      {options.slice(start, end).map((option, at) => <div key={option.key} data-option-key={option.key}
        role="presentation">{render(option, start + at)}</div>)}
    </div>
    <div aria-hidden style={{ height: offsets[options.length]! - offsets[end]! }} />
  </>;
}
