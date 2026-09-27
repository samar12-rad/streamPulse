import { useEffect, useId } from "react";
import { KeyboardIcon } from "../../shared/ui/icons";
import controls from "../../shared/ui/controls.module.css";
import { usePopover } from "../../shared/ui/usePopover";
import { useDashboard } from "../dashboard/state/useDashboard";
import { isTypingTarget, SEARCH_SHORTCUT_TARGET, SHORTCUTS, transitionForKey } from "./shortcuts";
import styles from "./shortcuts.module.css";

/** Global keyboard shortcuts, plus a button that lists them. */
export function KeyboardShortcuts() {
  const { state, dispatch } = useDashboard();
  const { open, setOpen, rootRef, buttonRef } = usePopover();
  const popoverId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (event.key === "/") {
        const search = document.querySelector<HTMLInputElement>(`[data-shortcut="${SEARCH_SHORTCUT_TARGET}"]`);
        if (search) {
          event.preventDefault();
          search.focus();
          search.select();
        }
        return;
      }
      if (event.key === "?") {
        setOpen((o) => !o);
        return;
      }
      const transition = transitionForKey(event.key, state);
      if (transition) {
        event.preventDefault();
        dispatch(transition);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [state, dispatch, setOpen]);

  return (
    <div className={controls.multiSelect} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={controls.iconButton}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        onClick={() => setOpen((o) => !o)}
      >
        <KeyboardIcon />
      </button>
      {open && (
        <div id={popoverId} className={`${controls.popover} ${styles.popover}`} role="dialog" aria-label="Keyboard shortcuts">
          <p className={styles.title}>Keyboard shortcuts</p>
          <dl className={styles.list}>
            {SHORTCUTS.map(({ keys, description }) => (
              <div key={keys} className={styles.row}>
                <dt>
                  <kbd className={styles.kbd}>{keys}</kbd>
                </dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
