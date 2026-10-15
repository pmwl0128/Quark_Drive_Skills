import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/** Keep a portalled popup inside the visible viewport, above its anchor when needed. */
export function useAnchoredPopover(open: boolean, anchor: RefObject<HTMLElement | null>,
  popup: RefObject<HTMLElement | null>, {
    minWidth = 160, matchAnchor = true, align = "start", maxHeight: heightLimit = 300,
  }: { minWidth?: number; matchAnchor?: boolean; align?: "start" | "end"; maxHeight?: number } = {}): CSSProperties {
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    if (!open) { setPosition({ visibility: "hidden" }); return; }
    let frame: number | null = null;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      const menu = popup.current;
      if (!rect || !menu) return;
      const viewport = window.visualViewport;
      const edge = 8;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportRight = viewportLeft + (viewport?.width ?? window.innerWidth);
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const width = Math.min(Math.max(matchAnchor ? rect.width : 0, minWidth), viewportRight - viewportLeft - 2 * edge);
      const below = viewportBottom - rect.bottom - edge - 6;
      const above = rect.top - viewportTop - edge - 6;
      const height = Math.min(menu.scrollHeight + 2, heightLimit);
      const useAbove = below < height && above > below;
      const maxHeight = Math.max(32, Math.min(heightLimit, useAbove ? above : below));
      const next: CSSProperties = {
        position: "fixed", visibility: "visible", width, maxHeight,
        left: Math.max(viewportLeft + edge, Math.min(align === "end" ? rect.right - width : rect.left, viewportRight - width - edge)),
        top: Math.max(viewportTop + edge, useAbove ? rect.top - Math.min(height, maxHeight) - 6 : rect.bottom + 6),
      };
      setPosition(current => Object.keys(next).every(key => current[key as keyof CSSProperties] === next[key as keyof CSSProperties])
        ? current : next);
    };
    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => { frame = null; place(); });
    };
    place();
    const observer = new ResizeObserver(schedule);
    if (anchor.current) observer.observe(anchor.current);
    if (popup.current) observer.observe(popup.current);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [open, anchor, popup, minWidth, matchAnchor, align, heightLimit]);
  return position;
}
