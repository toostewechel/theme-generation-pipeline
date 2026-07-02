import type { ThemeInputs } from "./types.js";

/** Emit a valid theme.config.ts source string for the given inputs. */
export function serializeConfig(inputs: ThemeInputs): string {
  const body = JSON.stringify(inputs, null, 2);
  return `type ThemeInputs = import("./src/engine/types.js").ThemeInputs;

const themeInputs: ThemeInputs = ${body};

export default themeInputs;
`;
}
