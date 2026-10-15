import { useCallback, useRef, useState } from "react";

/** Twelve distinct comparisons, oldest first. Reopening a pair updates its reading and reveals
 * the existing card without consuming a slot. Build/direction changes alone never rewrite it. */
export function useCellHistory<T>(scope: unknown, keyOf: (value: T) => string) {
  const frame = useRef<number | null>(null);
  const [state, setState] = useState<{
    scope: unknown; entries: Array<{ id: string; value: T }>; activeId: string | null; revision: number;
  }>(
    () => ({ scope, entries: [], activeId: null, revision: 0 }),
  );
  if (state.scope !== scope) setState({ scope, entries: [], activeId: null, revision: 0 });
  const entries = state.scope === scope ? state.entries : [];
  const append = useCallback((value: T) => {
    const id = keyOf(value);
    setState((current) => {
      const previous = current.scope === scope ? current.entries : [];
      const entry = { id, value };
      return { scope, activeId: id, revision: current.revision + 1,
        entries: previous.some((item) => item.id === id)
          ? previous.map((item) => item.id === id ? entry : item)
          : [...previous.slice(-11), entry],
      };
    });
  }, [scope, keyOf]);
  const remove = useCallback((id: string) => {
    setState((current) => ({ ...current,
      activeId: current.activeId === id ? null : current.activeId,
      entries: current.entries.filter((entry) => entry.id !== id),
    }));
  }, []);
  const clear = useCallback(() => {
    setState((current) => ({ ...current, entries: [], activeId: null }));
  }, []);
  // A callback ref also runs when the first detail arrives asynchronously. Revision makes an
  // already selected card scroll again on a repeated click; removal does not request a scroll.
  const panelRef = useCallback((node: HTMLDivElement | null) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (!node) return;
    frame.current = requestAnimationFrame(() => {
      if (node.isConnected) node.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      });
      frame.current = null;
    });
  }, [scope, state.revision]);
  return { entries, append, remove, clear, panelRef, activeId: state.activeId,
    selected: entries.find((entry) => entry.id === state.activeId)?.value ?? null };
}
