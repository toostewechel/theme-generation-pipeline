import { useEffect, useRef, useState } from "react";
import { Tabs } from "@base-ui-components/react/tabs";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { renderPreview } from "../ui/preview.js";

type PreviewTab = "ramps" | "playground";
const TAB_KEY = "cs-preview-tab";

export function Preview({
  state,
  mode,
  showContrast,
}: {
  state: ThemeInputs;
  mode: "light" | "dark";
  showContrast: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<PreviewTab>(
    () => (localStorage.getItem(TAB_KEY) as PreviewTab) || "ramps",
  );

  const onTab = (value: PreviewTab) => {
    setTab(value);
    localStorage.setItem(TAB_KEY, value);
  };

  useEffect(() => {
    if (contentRef.current) {
      renderPreview(state, mode, contentRef.current, { showContrast, tab });
    }
  }, [state, mode, showContrast, tab]);

  return (
    <main id="preview" className={mode === "dark" ? "mode-dark" : "mode-light"}>
      <Tabs.Root
        className="pv-tabs"
        value={tab}
        onValueChange={(value) => onTab(value as PreviewTab)}
      >
        <h3 className="pv-title">Preview</h3>
        <Tabs.List className="pv-tablist">
          <Tabs.Tab className="pv-tab" value="ramps">
            Color ramps
          </Tabs.Tab>
          <Tabs.Tab className="pv-tab" value="playground">
            Playground
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
      <div ref={contentRef} id="pv-content" />
    </main>
  );
}
