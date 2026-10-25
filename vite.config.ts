import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["manifold-3d"],
  },
  build: {
    target: "esnext",
    sourcemap: false,
    outDir: "dist/web",
    emptyOutDir: true,
  },
});
