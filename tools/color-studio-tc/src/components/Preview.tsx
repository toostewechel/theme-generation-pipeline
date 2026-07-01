import { useEffect, useRef, useState } from "react";
import { Segmented } from "@ui";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { renderPreview } from "../ui/preview.js";

type PreviewTab = "ramps" | "playground";
const TAB_KEY = "cs-tc-preview-tab";

const TAB_OPTIONS = [
  { label: "Color ramps", value: "ramps" },
  { label: "Playground", value: "playground" },
] as const;

export function Preview({
  state, mode, showContrast,
}: {
  state: ThemeInputs;
  mode: "light" | "dark";
  showContrast: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<PreviewTab>(
    () => (localStorage.getItem(TAB_KEY) as PreviewTab) || "ramps",
  );

  const onTab = (value: string) => {
    const next = value as PreviewTab;
    setTab(next);
    localStorage.setItem(TAB_KEY, next);
  };

  useEffect(() => {
    if (contentRef.current) {
      renderPreview(state, mode, contentRef.current, { showContrast, tab });
    }
  }, [state, mode, showContrast, tab]);

  return (
    <main id="preview" className={mode === "dark" ? "mode-dark" : "mode-light"}>
      <div className="pv-tabs">
        <h3 className="pv-title">Preview</h3>
        <div style={{ maxWidth: 280, marginTop: 10 }}>
          <Segmented name="Preview view" ariaLabel="Preview view"
            options={TAB_OPTIONS} value={tab} onValueChange={onTab} />
        </div>
      </div>
      <div ref={contentRef} id="pv-content" />
    </main>
  );
}
