import type { ThemeInputs } from "./src/engine/types.js";

const themeInputs: ThemeInputs = {
  neutral: { hue: 81, chroma: 0.010 }, // warm near-gray, calibrated to today's paper-ish tint (hue ~81.8, chroma ~0.010)
  contrast: "default",
  accents: {
    primary: { hue: 136, chroma: 0.128 }, // green (today's accent-500 ≈ #7db664, hue ~136.7)
    secondary: { hue: 220, chroma: 0.11 }, // sky/blue
    tertiary: { hue: 330, chroma: 0.1 }, // pink
  },
  status: {
    success: { hue: 150, chroma: 0.12 },
    error: { hue: 25, chroma: 0.17 },
    warning: { hue: 70, chroma: 0.15 },
    info: { hue: 240, chroma: 0.12 },
  },
};

export default themeInputs;
