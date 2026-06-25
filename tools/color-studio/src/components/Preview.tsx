import { useEffect, useRef } from "react";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { renderPreview } from "../ui/preview.js";

export function Preview({
  state,
  mode,
  showContrast,
}: {
  state: ThemeInputs;
  mode: "light" | "dark";
  showContrast: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) renderPreview(state, mode, ref.current, showContrast);
  }, [state, mode, showContrast]);
  return <main id="preview" ref={ref} />;
}
