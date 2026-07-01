import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: { alias: { "@project": resolve(__dirname, "../..") } },
  test: { environment: "node" },
});
