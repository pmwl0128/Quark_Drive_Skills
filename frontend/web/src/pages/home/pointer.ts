import type { PointerEvent } from "react";

const frames = new WeakMap<HTMLElement, { frame: number; x: number; y: number }>();

/** Hover effects read the pointer from CSS variables, written without a re-render: --mx/--my in px
 * from the element's corner (spotlights), --px/--py from -1 to 1 around its centre (tilt). Mouse
 * only: a touch has no hover to follow. */
export function trackPointer(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const el = event.currentTarget;
  const pending = frames.get(el);
  if (pending) { pending.x = event.clientX; pending.y = event.clientY; return; }
  const next = { frame: 0, x: event.clientX, y: event.clientY };
  frames.set(el, next);
  next.frame = requestAnimationFrame(() => {
    frames.delete(el);
    if (!el.isConnected) return;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const x = next.x - box.left;
    const y = next.y - box.top;
    el.style.setProperty("--mx", `${Math.round(x)}px`);
    el.style.setProperty("--my", `${Math.round(y)}px`);
    el.style.setProperty("--px", (x / box.width * 2 - 1).toFixed(3));
    el.style.setProperty("--py", (y / box.height * 2 - 1).toFixed(3));
  });
}

export function releasePointer(event: PointerEvent<HTMLElement>) {
  const pending = frames.get(event.currentTarget);
  if (pending) { cancelAnimationFrame(pending.frame); frames.delete(event.currentTarget); }
  event.currentTarget.style.setProperty("--px", "0");
  event.currentTarget.style.setProperty("--py", "0");
}
