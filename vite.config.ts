import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
    // Railway/most PaaS providers put the app behind a proxy on a
    // dynamically-assigned hostname — allow any host so `vite preview`
    // doesn't reject the request.
    allowedHosts: true,
  },
});
