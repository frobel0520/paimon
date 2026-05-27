import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages: base = /repo-name/ (set VITE_BASE_PATH in CI)
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
