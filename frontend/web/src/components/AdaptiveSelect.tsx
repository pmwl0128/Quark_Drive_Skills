import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import {
  Children, isValidElement, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useEscapeLayer } from "./EscapeLayers.tsx";
import { useAnchoredPopover } from "./useAnchoredPopover.ts";
import { useOutsidePress } from "../lib/popover.ts";
import "./styles.select.css";

interface Option { value: string; label: string; disabled: boolean }
type OptionProps = { value?: string | number; label?: string; disabled?: boolean; children?: ReactNode };

function textOf(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<OptionProps>(child)
    ? textOf(child.props.children) : String(child)).join("");
}

function optionsOf(children: ReactNode, disabled = false): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<OptionProps>(child)) return [];
    if (child.type !== "option") return optionsOf(child.props.children, disabled || !!child.props.disabled);
    const label = child.props.label ?? textOf(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: disabled || !!child.props.disabled }];
  });
}

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange" | "children"> {
  value: string | number;
  onValueChange: (value: string) => void;
  children: ReactNode;
  optionIcon?: (value: string) => ReactNode;
  leading?: ReactNode;
  /** Numeric stage controls keep a small popup; entity and prose choices have more room. */
  compact?: boolean;
}

/** A fixed-choice combobox using the same option surface as the searchable build inputs. */
export function AdaptiveSelect({ value, onValueChange, children, optionIcon, leading, compact = false,
  className, disabled, id, onKeyDown, onBlur, onClick, ...props }: Props) {
  const generatedId = useId();
  const triggerId = id ?? `select-${generatedId}`;
  const listId = `${triggerId}-list`;
  const anchor = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const options = optionsOf(children);
  const selected = options.findIndex(option => option.value === String(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const search = useRef({ text: "", at: 0 });
  const position = useAnchoredPopover(open, anchor, popup, { minWidth: compact ? 72 : optionIcon ? 200 : 160 });
  useEscapeLayer(open, () => setOpen(false), 40);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useOutsidePress(open, [anchor, popup], () => setOpen(false));
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const start = () => {
    setActive(selected >= 0 && !options[selected]?.disabled ? selected : Math.max(0, options.findIndex(option => !option.disabled)));
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== String(value)) onValueChange(option.value);
    setOpen(false);
    anchor.current?.focus({ preventScroll: true });
  };
  const move = (from: number, direction: number) => {
    let next = from + direction;
    while (next >= 0 && next < options.length) {
      if (!options[next]!.disabled) return next;
      next += direction;
    }
    return from;
  };
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) start();
      else setActive(current => move(current, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const from = event.key === "Home" ? -1 : options.length;
      const next = move(from, event.key === "Home" ? 1 : -1);
      if (next >= 0 && next < options.length) { setActive(next); setOpen(true); }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(active); else start();
    } else if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
    } else if (event.key === "Tab") setOpen(false);
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = (now - search.current.at > 700 ? "" : search.current.text) + event.key.toLocaleLowerCase();
      search.current = { text, at: now };
      const next = options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(text));
      if (next >= 0) { if (open) setActive(next); else choose(next); }
    }
  };

  return <>
    <button {...props} id={triggerId} ref={anchor} type="button" disabled={disabled}
      className={`adaptive-select${className ? ` ${className}` : ""}`} role="combobox"
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
      onClick={event => { onClick?.(event); if (!event.defaultPrevented) { if (open) setOpen(false); else start(); } }}
      onKeyDown={handleKey} onBlur={event => { setOpen(false); onBlur?.(event); }}>
      {leading && <span className="adaptive-select-leading" aria-hidden>{leading}</span>}
      <span className="adaptive-select-value">{options[selected]?.label ?? "—"}</span>
      <IconChevronDown className="adaptive-select-chevron" aria-hidden />
    </button>
    {open && createPortal(<div ref={popup} id={listId} role="listbox" aria-labelledby={triggerId}
      className={`adaptive-listbox rich adaptive-select-list${compact ? " compact" : ""}`} style={position}>
      {options.map((option, index) => <button key={`${option.value}-${index}`} id={`${listId}-${index}`}
        type="button" role="option" aria-selected={option.value === String(value)} disabled={option.disabled}
        tabIndex={-1} className={index === active ? "active" : ""}
        onPointerDown={event => event.preventDefault()} onPointerMove={() => { if (!option.disabled) setActive(index); }}
        onClick={() => choose(index)}>
        {optionIcon && <span className="adaptive-select-option-icon" aria-hidden>{optionIcon(option.value)}</span>}
        <span>{option.label}</span>
        <IconCheck className={`adaptive-select-check${option.value === String(value) ? " selected" : ""}`} aria-hidden />
      </button>)}
    </div>, document.body)}
  </>;
}
