import { useEffect, useRef } from "react";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { renderPreview } from "../ui/preview.js";

export function Preview({ state, mode }: { state: ThemeInputs; mode: "light" | "dark" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) renderPreview(state, mode, ref.current);
  }, [state, mode]);
  return <main id="preview" ref={ref} />;
}
