import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon } from "./icons";
import styles from "./controls.module.css";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  selected: readonly string[];
  onChange: (values: string[]) => void;
  options: readonly MultiSelectOption[] | undefined;
  /** Rendered inside the popover instead of the list, e.g. while options load or fail. */
  placeholder?: ReactNode;
  /** Label for a selected value when options haven't loaded (or failed) — selections come from the URL. */
  fallbackLabel?: (value: string) => string;
}

/**
 * A dropdown of checkboxes. An empty selection means "All" — matching the API,
 * where a missing or empty filter array means no filter.
 */
export function MultiSelect({ label, selected, onChange, options, placeholder, fallbackLabel }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const labelFor = (value: string) => options?.find((o) => o.value === value)?.label ?? fallbackLabel?.(value) ?? value;
  const summary = selected.length === 0 ? "All" : selected.length === 1 ? labelFor(selected[0] ?? "") : `${selected.length} selected`;

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div className={styles.multiSelect} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.control}
        data-active={selected.length > 0 || undefined}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.prefix}>{label}</span>
        <span className={styles.value}>{summary}</span>
        <ChevronDownIcon className={styles.chevron} width={14} height={14} />
      </button>

      {open && (
        <div id={popoverId} className={styles.popover} role="group" aria-label={`${label} filter`}>
          {placeholder ?? (
            <>
              <button type="button" className={styles.option} onClick={() => onChange([])} aria-pressed={selected.length === 0}>
                <span className={styles.checkbox} data-checked={selected.length === 0}>
                  {selected.length === 0 && <CheckIcon width={12} height={12} />}
                </span>
                All
              </button>
              <div className={styles.divider} />
              {options?.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <label key={option.value} className={styles.option}>
                    <input type="checkbox" className="visually-hidden" checked={checked} onChange={() => toggle(option.value)} />
                    <span className={styles.checkbox} data-checked={checked} aria-hidden="true">
                      {checked && <CheckIcon width={12} height={12} />}
                    </span>
                    {option.label}
                  </label>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
