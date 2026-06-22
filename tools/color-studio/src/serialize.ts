import type { ThemeInputs } from "@project/src/engine/types.js";

/** Collect all leaf number values into a flat `key: value` comment for readability. */
function flatComment(obj: unknown, prefix = ""): string {
  if (obj === null || typeof obj !== "object") return "";
  return Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => {
      const path = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "number") return `${k}: ${v}`;
      return flatComment(v, path);
    })
    .filter(Boolean)
    .join(", ");
}

/** Emit a valid theme.config.ts source string for the given inputs. */
export function serializeConfig(inputs: ThemeInputs): string {
  const body = JSON.stringify(inputs, null, 2);
  const comment = flatComment(inputs);
  return `// ${comment}
type ThemeInputs = import("./src/engine/types.js").ThemeInputs;

const themeInputs: ThemeInputs = ${body};

export default themeInputs;
`;
}
