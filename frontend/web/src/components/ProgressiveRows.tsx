import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSharedT } from "./messages.ts";

/** Search still reads the complete result set. Mount more rows as its tail approaches the viewport;
 * a new result set starts at its beginning. The button also works without IntersectionObserver. */
export function useProgressiveRows<T>(rows: readonly T[], step = 60) {
  const [range, setRange] = useState(() => ({ rows, count: step }));
  const count = range.rows === rows ? range.count : step;
  const more = count < rows.length;
  const tail = useRef<HTMLButtonElement>(null);
  const reveal = useCallback(() => startTransition(() => {
    setRange(previous => ({ rows, count: Math.min(rows.length,
      (previous.rows === rows ? previous.count : step) + step) }));
  }), [rows, step]);
  useEffect(() => {
    const node = tail.current;
    if (!more || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) reveal();
    }, { rootMargin: "240px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [rows, count, more, reveal]);
  return { rows: useMemo(() => rows.slice(0, count), [rows, count]), more, tail, reveal };
}

export function MoreRows({ list }: { list: Pick<ReturnType<typeof useProgressiveRows>, "more" | "tail" | "reveal"> }) {
  const t = useSharedT();
  return list.more ? (
    <button ref={list.tail} type="button" className="more-rows secondary-btn" onClick={list.reveal}>
      {t("results.more")}
    </button>
  ) : null;
}
