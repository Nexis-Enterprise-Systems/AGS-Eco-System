import type { SystemSettings } from "./types";

// Applies the client's own branding (from their system_settings row)
// onto :root as CSS custom properties. tailwind.config.ts's brand/
// surface/ink colours all resolve through these variables, so the
// entire UI re-themes itself the moment System Settings is saved —
// no rebuild, no redeploy, per client.
const CSS_VAR_MAP: Record<keyof Pick<
  SystemSettings,
  | "color_primary"
  | "color_secondary"
  | "color_accent"
  | "color_surface"
  | "color_surface_muted"
  | "color_ink"
  | "color_ink_muted"
>, string> = {
  color_primary: "--color-primary",
  color_secondary: "--color-secondary",
  color_accent: "--color-accent",
  color_surface: "--color-surface",
  color_surface_muted: "--color-surface-muted",
  color_ink: "--color-ink",
  color_ink_muted: "--color-ink-muted",
};

type ThemeInput = Pick<SystemSettings, keyof typeof CSS_VAR_MAP> | null | undefined;
let lastTheme: ThemeInput = null;

export function applyTheme(settings: ThemeInput) {
  lastTheme = settings ?? lastTheme;
  const root = document.documentElement;
  const dark = root.getAttribute("data-theme") === "dark";
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP) as [keyof typeof CSS_VAR_MAP, string][]) {
    const value = lastTheme?.[key];
    // Dark mode: drop the inline overrides so the fixed dark palette in
    // index.css applies. Light mode: the client's own saved colours.
    if (dark || !value) root.style.removeProperty(cssVar);
    else root.style.setProperty(cssVar, value);
  }
}

// Re-apply when the colour mode flips.
if (typeof window !== "undefined") {
  window.addEventListener("ags-theme-change", () => applyTheme(undefined));
}

// AGS is a single-brand system: the browser tab keeps the bundled AGS icon
// (public/favicon.png) and the fixed title from index.html, whatever the
// database branding says. Kept as a no-op so the callers don't change.
export function applyCompanyIdentity(_companyName?: string | null, _logoUrl?: string | null) {
  document.title = "AGS Eco System";
}

// Simple "R G B" -> hex helper for places (e.g. a colour picker) that
// need a hex value rather than the space-separated triplet stored in
// the database and consumed by Tailwind's rgb(var(--x) / <alpha>) syntax.
export function rgbTripletToHex(triplet: string): string {
  const [r, g, b] = triplet.trim().split(/\s+/).map(Number);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "#000000";
  return (
    "#" +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r} ${g} ${b}`;
}
