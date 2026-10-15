import { IconLock } from "@tabler/icons-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { STATUS_ICONS } from "../../assets/status.ts";
import type { ItemRef } from "../../runtime/projection.ts";
import { GameImage } from "../GameImage.tsx";
import { useSharedT } from "../messages.ts";
import { useAnchoredPopover } from "../useAnchoredPopover.ts";
import { useEscapeLayer } from "../EscapeLayers.tsx";

function FieldLabel({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return <span className="build-field-label">
    <span>{children}</span><span className="build-field-icon" aria-hidden>{icon}</span>
  </span>;
}

export function ItemFieldLabel({ value, items }: { value: string; items: ItemRef[] }) {
  const t = useSharedT();
  const item = items.find((candidate) => candidate.name === value);
  return <FieldLabel icon={item ? <GameImage assetKey={item.key} role="dense" alt="" /> : undefined}>
    {t("calc.item")}
  </FieldLabel>;
}

export function StatusFieldLabel({ value }: { value: string }) {
  const t = useSharedT();
  const icon = STATUS_ICONS[value];
  return <FieldLabel icon={icon ? <img src={icon} alt="" /> : undefined}>{t("calc.status")}</FieldLabel>;
}

/** Disabled inputs cannot receive focus; the surrounding field explains the lock on hover or focus. */
export function ItemLock({ locked, children }: { locked?: boolean; children: ReactNode }) {
  const t = useSharedT();
  const tipId = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const popup = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = !!locked && (hovered || focused);
  const position = useAnchoredPopover(open, anchor, popup, { minWidth: 260, matchAnchor: false });
  useEscapeLayer(open, () => { setHovered(false); setFocused(false); anchor.current?.blur(); }, 40);
  return <span ref={anchor} className={`item-control${locked ? " locked" : ""}`}
    tabIndex={locked ? 0 : undefined} role={locked ? "group" : undefined}
    aria-label={locked ? t("calc.itemLocked") : undefined}
    aria-describedby={locked ? tipId : undefined}
    onMouseEnter={locked ? () => setHovered(true) : undefined} onMouseLeave={() => setHovered(false)}
    onFocus={locked ? () => setFocused(true) : undefined} onBlur={() => setFocused(false)}>
    {children}
    {locked && <>
      <IconLock className="item-lock-icon" aria-hidden />
      {createPortal(<span ref={popup} className={open ? "item-lock-tip" : "sr-only"}
        role={open ? "tooltip" : undefined} id={tipId}
        style={open ? position : undefined}>{t("calc.itemLockedHint")}</span>, document.body)}
    </>}
  </span>;
}
