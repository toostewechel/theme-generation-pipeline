import { useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "@ui";
import { toast } from "sonner";
import themeInputs from "@project/theme.config.js";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { Sidebar } from "./components/Sidebar.js";
import { Preview } from "./components/Preview.js";
import { serializeConfig } from "./serialize.js";
import { copyTokensForFigma } from "./export-figma.js";
import { withDarkSurfaceFallback } from "./lib/theme-state.js";

export default function App() {
  const baseline = useMemo(
    () => withDarkSurfaceFallback(structuredClone(themeInputs) as ThemeInputs),
    [],
  );
  const [state, setState] = useState<ThemeInputs>(() => structuredClone(baseline));
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [showContrast, setShowContrast] = useState(true);

  const frame = useRef(0);
  const pendingRef = useRef<ThemeInputs | null>(null);
  const [rafState, setRafState] = useState<ThemeInputs>(state);

  const update = (next: ThemeInputs) => {
    setState(next);
    pendingRef.current = next;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const latest = pendingRef.current!;
      pendingRef.current = null;
      setRafState(latest);
    });
  };

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);

  const toggleMode = () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("mode-dark", next === "dark");
  };

  const onSave = async () => {
    try {
      const res = await fetch("/__save-theme", { method: "POST", body: serializeConfig(state) });
      if (res.ok) toast.success("Saved ✓");
      // The /__save-theme endpoint only exists on the Vite dev/preview server. A
      // non-OK status means it's missing (e.g. a static build) — say so.
      else toast.error(`Save failed (HTTP ${res.status})`);
    } catch {
      // fetch rejected: the dev/preview server isn't reachable at this origin.
      toast.error("Save failed — dev server not reachable (run via `npm run dev`)");
    }
  };

  const onCopyFigma = async () => {
    const ok = await copyTokensForFigma(state);
    if (ok) toast.success("Copied ✓"); else toast.error("Copy failed");
  };

  const onResetAll = () => update(structuredClone(baseline));

  return (
    <div id="app">
      <div className="cs-panel-col">
        <Sidebar
          state={state}
          baseline={baseline}
          mode={mode}
          showContrast={showContrast}
          onChange={update}
          onModeToggle={toggleMode}
          onShowContrastChange={setShowContrast}
          onSave={onSave}
          onCopyFigma={onCopyFigma}
          onResetAll={onResetAll}
        />
      </div>
      <Preview state={rafState} mode={mode} showContrast={showContrast} />
      <Toaster position="bottom-right" />
    </div>
  );
}
