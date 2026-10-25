import { useColorMode } from "../lib/colorMode";

// The company logo, as set in System Settings -> Business Units -> Branding.
// If no logo has been uploaded, falls back to the bundled AGS wordmark
// (light or dark version to match the colour mode). An uploaded logo is
// shown as is.
export function BrandLogo({ src, maxWidth = 200 }: { src?: string | null; maxWidth?: number }) {
  const [mode] = useColorMode();
  const fallback = mode === "dark" ? "/ags-logo-dark.png" : "/ags-logo.png";
  return (
    <img
      src={src || fallback}
      alt="Company logo"
      style={{ maxWidth }}
      className="mx-auto block max-h-24 w-full object-contain"
    />
  );
}
