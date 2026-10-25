import type { Config } from "tailwindcss";

// Brand colors are NOT hard-coded here. They resolve to CSS custom
// properties that src/lib/theme.ts writes onto :root at runtime, read
// from the client's own system_settings row in Supabase. This is what
// lets every standalone client deployment carry its own colour scheme
// from one codebase.
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "rgb(var(--color-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-secondary) / <alpha-value>)",
          accent: "rgb(var(--color-accent) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          muted: "rgb(var(--color-surface-muted) / <alpha-value>)",
        },
        line: "rgb(var(--color-line) / <alpha-value>)",
        "on-primary": "rgb(var(--color-on-primary) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          muted: "rgb(var(--color-ink-muted) / <alpha-value>)",
        },
      },
      fontFamily: {
        // Public Sans everywhere by default — same body/UI face as the
        // sales tool, but this platform's login (and the rest of the
        // app) stays in normal sentence case rather than that tool's
        // uppercase-tracked treatment.
        sans: ["Jost", "Helvetica Neue", "Arial", "sans-serif"],
        // Reserved for editorial moments — right now just the company
        // name on the login screen — never for labels or body copy.
        display: ["Cormorant Garamond", "Georgia", "Times New Roman", "serif"],
        mono: ["IBM Plex Mono", "Courier New", "Courier", "monospace"],
      },
      borderRadius: {
        card: "2px",
      },
    },
  },
  plugins: [],
} satisfies Config;
