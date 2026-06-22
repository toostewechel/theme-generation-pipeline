import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tools/color-studio/src/**/*.test.ts"],
    environment: "node",
  },
});
