import type { ChangeEvent } from "react";
import { ChevronDownIcon } from "./icons";
import styles from "./controls.module.css";

export interface SelectOption<V extends string> {
  value: V;
  label: string;
}

interface SelectProps<V extends string> {
  /** Visible prefix inside the control, e.g. "Range". Also used as the accessible name. */
  label: string;
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  active?: boolean;
}

/**
 * A styled native `<select>`: keyboard, screen-reader and mobile behaviour come
 * for free, which is the right trade-off for simple single-choice controls.
 */
export function Select<V extends string>({ label, value, options, onChange, active }: SelectProps<V>) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const option = options.find((o) => o.value === event.target.value);
    if (option) onChange(option.value);
  };

  return (
    <label className={styles.control} data-active={active || undefined}>
      <span className={styles.prefix}>{label}</span>
      <select className={styles.nativeSelect} value={value} onChange={handleChange}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className={styles.chevron} width={14} height={14} />
    </label>
  );
}
