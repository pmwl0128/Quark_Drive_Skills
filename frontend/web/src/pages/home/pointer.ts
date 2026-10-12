import type { PointerEvent } from "react";

/** Hover effects read the pointer from CSS variables, written without a re-render: --mx/--my in px
 * from the element's corner (spotlights), --px/--py from -1 to 1 around its centre (tilt). Mouse
 * only: a touch has no hover to follow. */
export function trackPointer(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const el = event.currentTarget;
  const box = el.getBoundingClientRect();
  const x = event.clientX - box.left;
  const y = event.clientY - box.top;
  el.style.setProperty("--mx", `${Math.round(x)}px`);
  el.style.setProperty("--my", `${Math.round(y)}px`);
  el.style.setProperty("--px", (x / box.width * 2 - 1).toFixed(3));
  el.style.setProperty("--py", (y / box.height * 2 - 1).toFixed(3));
}

export function releasePointer(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty("--px", "0");
  event.currentTarget.style.setProperty("--py", "0");
}
