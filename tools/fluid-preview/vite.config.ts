import { defineConfig } from "vite";
import { resolve } from "path";

const projectRoot = resolve(__dirname, "../..");

export default defineConfig({
  root: ".",
  resolve: {
    alias: {
      "@project": projectRoot,
    },
  },
  server: {
    open: true,
    fs: {
      allow: [projectRoot],
    },
  },
});
