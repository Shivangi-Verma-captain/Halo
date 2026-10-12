import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves this repository beneath /Halo/; local dev stays at /.
  base: process.env.GITHUB_ACTIONS === "true" ? "/Halo/" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Local dev: same-origin API + socket passthrough (avoids CORS entirely).
      "/socket.io": {
        target: process.env.VITE_SERVER_URL ?? "http://localhost:3001",
        ws: true,
      },
      "/health": {
        target: process.env.VITE_SERVER_URL ?? "http://localhost:3001",
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
