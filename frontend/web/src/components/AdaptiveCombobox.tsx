import {
  Fragment, useEffect, useId, useMemo, useRef, useState,
  type InputHTMLAttributes, type KeyboardEvent, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ComboboxOptions } from "./ComboboxOptions.tsx";
import { useAnchoredPopover } from "./useAnchoredPopover.ts";
import "./styles.select.css";

interface ComboboxOption {
  key: string;
  value: string;
  /** Optional visual label; selection and search still use the plain-text value. */
  label?: ReactNode;
  secondary?: string;
  searchText?: string;
  /** Leads the list: the metagame's own picks for this Pokémon, set off from the rest by a rule. */
  group?: "meta";
  /** A short figure beside the option (its usage share). */
  badge?: string;
  /** A heading for consecutive options, independent of the usage-ranked group. */
  section?: string;
}

export type ComboboxCommitReason = "selection" | "enter" | "blur";

interface AdaptiveComboboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "list"
> {
  value: string;
  options: ComboboxOption[];
  onValueChange: (value: string) => void;
  onCommit?: (value: string, reason: ComboboxCommitReason) => void;
  popupHeader?: ReactNode;
  popupMinWidth?: number;
  emptyMessage?: string;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function AdaptiveCombobox({
  value, options, onValueChange, onCommit, disabled,
  popupHeader, popupMinWidth = 240, emptyMessage,
  onFocus, onBlur, onKeyDown, onClick, ...inputProps
}: AdaptiveComboboxProps) {
  const reactId = useId().replace(/:/g, "");
  const listId = `adaptive-list-${reactId}`;
  const inputId = inputProps.id ?? `adaptive-input-${reactId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const placement = useAnchoredPopover(open, inputRef, popupRef, { minWidth: popupMinWidth });
  // Whether the reader has typed since the list opened. Until then the text is the current value,
  // and a list filtered by it would show only that value.
  const [typed, setTyped] = useState(false);

  const filtered = useMemo(() => {
    if (!typed) return options;
    const needle = normalized(value);
    const hits = needle
      ? options.filter((option) => normalized(
        `${option.value} ${option.secondary ?? ""} ${option.searchText ?? ""}`,
      ).includes(needle))
      : options;
    return hits.slice(0, 120);
  }, [options, value, typed]);

  useEffect(() => setActive(0), [value, options]);
  // Keyboard moves keep the active option in view.
  useEffect(() => {
    if (!open || filtered.length > 60) return;
    document.getElementById(`${listId}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId, filtered.length]);

  const openList = () => {
    setTyped(false);
    setActive(Math.max(0, options.findIndex(option => option.value === value)));
    setOpen(true);
  };

  const select = (option: ComboboxOption) => {
    onValueChange(option.value);
    onCommit?.(option.value, "selection");
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => Math.max(0, Math.min(current + (open ? 1 : 0), filtered.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter" && open && filtered[active]) {
      event.preventDefault();
      select(filtered[active]);
    } else if (event.key === "Escape" && open) {
      // Closes the list only — not the dialog the input may sit in.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Tab" && open && popupHeader && !event.shiftKey) {
      const first = popupRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)");
      if (first) { event.preventDefault(); first.focus(); }
    } else if (event.key === "Enter") {
      onCommit?.(value, "enter");
    }
    onKeyDown?.(event);
  };

  const optionRow = (option: ComboboxOption, index: number) => <Fragment key={option.key}>
    {option.section && (index === 0 || filtered[index - 1]!.section !== option.section) && (
      <div className="adaptive-section" role="presentation">{option.section}</div>
    )}
    {!option.section && index > 0 && option.group !== "meta" && filtered[index - 1]!.group === "meta" && (
      <div className="adaptive-sep" role="separator" />
    )}
    <button id={`${listId}-option-${index}`} type="button" role="option" tabIndex={-1}
      aria-selected={index === active} aria-posinset={index + 1} aria-setsize={filtered.length}
      className={`${index === active ? "active" : ""}${option.group === "meta" ? " meta" : ""}`}
      onPointerDown={(event) => event.preventDefault()} onPointerMove={() => setActive(index)}
      onClick={() => select(option)}>
      <span>{option.label ?? option.value}</span>
      {option.secondary && option.secondary !== option.value && <small>{option.secondary}</small>}
      {option.badge && <b className="adaptive-share">{option.badge}</b>}
    </button>
  </Fragment>;

  const input = (
    <input
      {...inputProps}
      id={inputId}
      ref={inputRef}
      value={value}
      disabled={disabled}
      autoComplete={inputProps.autoComplete ?? "off"}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-activedescendant={open && filtered[active]
        ? `${listId}-option-${active}` : undefined}
      onChange={(event) => {
        onValueChange(event.target.value);
        setTyped(true);
        setOpen(true);
      }}
      onFocus={(event) => {
        if (!disabled && !open) openList();
        onFocus?.(event);
      }}
      onClick={(event) => {
        // Reopens a list closed with Escape while the input kept focus.
        if (!disabled && !open) openList();
        onClick?.(event);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        if (popupRef.current?.contains(event.relatedTarget)) return;
        onCommit?.(value, "blur");
        setOpen(false);
      }}
      onKeyDown={handleKey}
    />
  );

  return (
    <>
      {input}
      {open && (filtered.length > 0 || popupHeader || emptyMessage) && createPortal(
        <div
          ref={popupRef}
          data-focus-owner={inputId}
          className="adaptive-listbox rich adaptive-combobox-popup"
          style={placement}
          onBlur={(event) => {
            if (event.relatedTarget === inputRef.current || event.currentTarget.contains(event.relatedTarget)) return;
            onCommit?.(value, "blur");
            setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled):not([tabindex='-1'])",
              ));
              if (event.shiftKey && event.target === buttons[0]) {
                event.preventDefault();
                inputRef.current?.focus();
              } else if (!event.shiftKey && event.target === buttons.at(-1)) {
                event.preventDefault();
                // The popup lives at the end of body. Continue from the input's place in the form.
                const fields = Array.from(document.querySelectorAll<HTMLElement>(
                  "a[href],button,input,select,textarea,[tabindex]",
                )).filter(node => node.tabIndex >= 0 && !node.hasAttribute("disabled")
                  && node.getClientRects().length && !event.currentTarget.contains(node));
                const at = fields.indexOf(inputRef.current!);
                (fields[at + 1] ?? inputRef.current)?.focus();
                setOpen(false);
              }
              return;
            }
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            inputRef.current?.focus();
          }}
        >
          {popupHeader}
          <div ref={optionsRef} id={listId} role="listbox" className="adaptive-combobox-options">
            {filtered.length > 60
              ? <ComboboxOptions options={filtered} active={active} popup={optionsRef} render={optionRow} />
              : filtered.map(optionRow)}
            {!filtered.length && emptyMessage && <div className="adaptive-empty" role="status">{emptyMessage}</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
