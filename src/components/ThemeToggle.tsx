import { useColorMode } from "../lib/colorMode";

// Small text switch, same wording as the AGS website: shows the mode
// you would switch TO.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useColorMode();
  const dark = mode === "dark";
  return (
    <button
      type="button"
      onClick={() => setMode(dark ? "light" : "dark")}
      aria-pressed={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`text-xs font-medium uppercase tracking-[0.16em] text-ink-muted hover:text-ink ${className}`}
    >
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
