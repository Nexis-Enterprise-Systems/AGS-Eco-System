import { useEffect, useState } from "react";

// Light / dark switch. Light is the default and the system setting is
// never consulted (same rule as the AGS website). The choice is
// remembered in this browser only.
export type ColorMode = "light" | "dark";
const KEY = "ags-theme";
const EVENT = "ags-theme-change";

export function getColorMode(): ColorMode {
  try {
    if (localStorage.getItem(KEY) === "dark") return "dark";
  } catch {
    /* storage blocked: stay on light */
  }
  return "light";
}

export function applyColorMode(mode: ColorMode) {
  document.documentElement.setAttribute("data-theme", mode);
}

export function setColorMode(mode: ColorMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
  applyColorMode(mode);
  window.dispatchEvent(new Event(EVENT));
}

export function useColorMode(): [ColorMode, (m: ColorMode) => void] {
  const [mode, setMode] = useState<ColorMode>(getColorMode);
  useEffect(() => {
    const onChange = () => setMode(getColorMode());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return [mode, setColorMode];
}
