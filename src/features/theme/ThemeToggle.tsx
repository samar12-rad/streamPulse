import { MoonIcon, SunIcon } from "../../shared/ui/icons";
import controls from "../../shared/ui/controls.module.css";
import { useTheme } from "./themeStore";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button type="button" className={controls.iconButton} onClick={toggleTheme} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
