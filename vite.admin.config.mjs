import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "admin-react",
  base: "/admin-assets/",
  build: {
    outDir: "../admin-dist",
    emptyOutDir: true,
  },
});
