import { useState } from "react";
import { useDebouncedCallback } from "../../shared/lib/useDebouncedCallback";
import { CloseIcon, SearchIcon } from "../../shared/ui/icons";
import { SEARCH_SHORTCUT_TARGET } from "../shortcuts/shortcuts";
import styles from "./breakdown.module.css";

export const SEARCH_DEBOUNCE_MS = 300;

interface BreakdownSearchProps {
  /** Committed search term (from the URL). */
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
}

/**
 * Keeps a local draft for instant typing feedback and commits it to the URL —
 * which triggers the server-side query — 300 ms after the user stops typing.
 */
export function BreakdownSearch({ value, placeholder, onCommit }: BreakdownSearchProps) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedCallback(onCommit, SEARCH_DEBOUNCE_MS);

  // Adopt external changes to the committed value (e.g. browser Back) — the
  // "adjust state during render" pattern, which avoids an extra effect pass.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  const update = (next: string) => {
    setDraft(next);
    debounced.run(next);
  };

  const commitNow = (next: string) => {
    debounced.cancel();
    setDraft(next);
    onCommit(next);
  };

  return (
    <div className={styles.search}>
      <SearchIcon className={styles.searchIcon} width={14} height={14} />
      <input
        type="search"
        className={styles.searchInput}
        data-shortcut={SEARCH_SHORTCUT_TARGET}
        value={draft}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-keyshortcuts="/"
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitNow(draft);
          if (event.key === "Escape" && draft) {
            event.preventDefault();
            commitNow("");
          }
        }}
      />
      {!draft && (
        <kbd className={styles.searchKbd} aria-hidden="true">
          /
        </kbd>
      )}
      {draft && (
        <button type="button" className={styles.searchClear} onClick={() => commitNow("")} aria-label="Clear search">
          <CloseIcon width={12} height={12} />
        </button>
      )}
    </div>
  );
}
