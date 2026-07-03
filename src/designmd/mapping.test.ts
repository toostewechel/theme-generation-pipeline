import { describe, it, expect } from "vitest";
import {
  COLOR_SLOTS,
  TYPOGRAPHY_SLOTS,
  SPACING_SLOTS,
  ROUNDED_SLOTS,
} from "./mapping.js";
import { loadTokenMap } from "./load-tokens.js";
import type { ColorMode, RadiusMode } from "./types.js";

const COLOR_MODES: ColorMode[] = ["light", "dark"];
const RADIUS_MODES: RadiusMode[] = ["small", "medium", "large", "full"];

describe("mapping drift guard (real repo tokens)", () => {
  it.each(COLOR_MODES)(
    "every mapped token exists in the %s color mode",
    (colorMode) => {
      const map = loadTokenMap({ colorMode, radiusMode: "medium" });
      const names = [
        ...Object.values(COLOR_SLOTS),
        ...Object.values(TYPOGRAPHY_SLOTS),
        ...Object.values(SPACING_SLOTS),
      ];
      for (const name of names) {
        expect(map[name], `token "${name}" missing in ${colorMode} mode`).toBeDefined();
      }
    },
  );

  it.each(RADIUS_MODES)(
    "every rounded slot exists in the %s radius mode",
    (radiusMode) => {
      const map = loadTokenMap({ colorMode: "light", radiusMode });
      for (const name of Object.values(ROUNDED_SLOTS)) {
        expect(map[name], `token "${name}" missing in ${radiusMode} mode`).toBeDefined();
      }
    },
  );
});
