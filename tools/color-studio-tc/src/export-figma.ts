import { serializeTokenBundle } from "@project/src/engine/index.js";
import type { ThemeInputs } from "@project/src/engine/index.js";

/** Serialize the token bundle for the current state and copy it to the clipboard.
 *  Returns true on success, false if serialization or the clipboard write fails. */
export async function copyTokensForFigma(state: ThemeInputs): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(serializeTokenBundle(state));
    return true;
  } catch {
    return false;
  }
}
