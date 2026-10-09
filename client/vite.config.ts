import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
