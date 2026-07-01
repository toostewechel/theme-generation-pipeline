import { defineConfig, defaultExclude } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@project": resolve(__dirname, "../.."),
      "@ui/": resolve(__dirname, "src/ui/"),
      "@ui": resolve(__dirname, "src/ui/index.ts"),
    },
  },
  test: { environment: "node", globals: true, exclude: ["e2e/**", ...defaultExclude] },
});
