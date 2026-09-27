import { useId, useState, type FormEvent } from "react";
import { DATE_PRESETS } from "../../api/types";
import { DATA_WINDOW_DAYS, isPreset, normalizeCustomRange, rangeLabel, type RangeSelection } from "../../shared/lib/timeRange";
import { CheckIcon, ChevronDownIcon } from "../../shared/ui/icons";
import controls from "../../shared/ui/controls.module.css";
import { usePopover } from "../../shared/ui/usePopover";
import styles from "./filters.module.css";

interface RangePickerProps {
  value: RangeSelection;
  /** End of the data (the hour the page was opened); custom ranges can't go past it. */
  anchorSec: number;
  onChange: (range: RangeSelection) => void;
}

/** `<input type="datetime-local">` works in local time, without seconds. */
function toLocalInput(sec: number): string {
  const d = new Date(sec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): number {
  return value ? new Date(value).getTime() / 1000 : Number.NaN;
}

/** Presets plus a custom from/to window, in one popover. */
export function RangePicker({ value, anchorSec, onChange }: RangePickerProps) {
  const { open, setOpen, rootRef, buttonRef } = usePopover();
  const popoverId = useId();

  return (
    <div className={controls.multiSelect} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={controls.control}
        data-active={!isPreset(value) || undefined}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup="true"
        title={isPreset(value) ? undefined : rangeLabel(value)}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={controls.prefix}>Range</span>
        <span className={styles.rangeValue}>{isPreset(value) ? rangeLabel(value) : `Custom · ${rangeLabel(value)}`}</span>
        <ChevronDownIcon className={controls.chevron} width={14} height={14} />
      </button>

      {open && (
        <div id={popoverId} className={`${controls.popover} ${styles.rangePopover}`} role="group" aria-label="Date range">
          {DATE_PRESETS.map((preset) => {
            const selected = value === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                className={controls.option}
                aria-pressed={selected}
                onClick={() => {
                  onChange(preset.key);
                  setOpen(false);
                }}
              >
                <span className={styles.rangeCheck}>{selected && <CheckIcon width={14} height={14} />}</span>
                {preset.label}
              </button>
            );
          })}
          <div className={controls.divider} />
          <CustomRangeForm
            value={value}
            anchorSec={anchorSec}
            onApply={(range) => {
              onChange(range);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

interface CustomRangeFormProps {
  value: RangeSelection;
  anchorSec: number;
  onApply: (range: RangeSelection) => void;
}

function CustomRangeForm({ value, anchorSec, onApply }: CustomRangeFormProps) {
  const minSec = anchorSec - DATA_WINDOW_DAYS * 24 * 3600;
  // Start from the current window so "custom" is a tweak of what's on screen.
  const initial = isPreset(value)
    ? { from: anchorSec - (DATE_PRESETS.find((p) => p.key === value)?.durationSec ?? 0), to: anchorSec }
    : value;
  const [from, setFrom] = useState(() => toLocalInput(initial.from));
  const [to, setTo] = useState(() => toLocalInput(initial.to));

  const fromSec = fromLocalInput(from);
  const toSec = fromLocalInput(to);
  const error =
    !Number.isFinite(fromSec) || !Number.isFinite(toSec)
      ? "Enter both a start and an end."
      : toSec <= fromSec
        ? "The end must be after the start."
        : toSec > anchorSec + 3600 || fromSec < minSec - 3600
          ? `Data covers the last ${DATA_WINDOW_DAYS} days only.`
          : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const range = error ? null : normalizeCustomRange(Math.max(fromSec, minSec), Math.min(toSec, anchorSec));
    if (range) onApply(range);
  };

  return (
    <form className={styles.customRange} onSubmit={submit} noValidate>
      <p className={styles.customTitle}>Custom range</p>
      <label className={styles.field}>
        <span>From</span>
        <input
          type="datetime-local"
          step={3600}
          min={toLocalInput(minSec)}
          max={toLocalInput(anchorSec)}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>To</span>
        <input
          type="datetime-local"
          step={3600}
          min={toLocalInput(minSec)}
          max={toLocalInput(anchorSec)}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
      <p className={styles.fieldHint} role={error ? "alert" : undefined}>
        {error ?? "Rounded out to whole UTC hours. Tip: drag across the chart to zoom."}
      </p>
      <button type="submit" className={styles.apply} disabled={error !== null}>
        Apply
      </button>
    </form>
  );
}
