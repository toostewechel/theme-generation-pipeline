import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "@base-ui-components/react/tooltip";
import { Toast } from "@base-ui-components/react/toast";
import themeInputs from "@project/theme.config.js";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { Sidebar } from "./components/Sidebar.js";
import { Preview } from "./components/Preview.js";
import { serializeConfig } from "./serialize.js";
import { copyTokensForFigma } from "./export-figma.js";
import { withDarkSurfaceFallback } from "./lib/theme-state.js";

function AppInner() {
  const baseline = useMemo(
    () => withDarkSurfaceFallback(structuredClone(themeInputs) as ThemeInputs),
    [],
  );
  const [state, setState] = useState<ThemeInputs>(() => structuredClone(baseline));
  const [mode, setMode] = useState<"light" | "dark">("light");
  // Preview display preference (contrast badges on ramp swatches). Owned here so
  // the control can live in the sidebar; not part of ThemeInputs / saved config.
  const [showContrast, setShowContrast] = useState(true);
  const toast = Toast.useToastManager();

  // Coalesce preview re-renders to one per frame. `state` updates immediately so
  // controls stay responsive; `rafState` — what Preview consumes — only advances
  // once per animation frame. A ref holds the pending "latest" value so that
  // rapid successive calls always converge to the last state (no stale closure).
  const frame = useRef(0);
  const pendingRef = useRef<ThemeInputs | null>(null);
  const [rafState, setRafState] = useState<ThemeInputs>(state);

  const update = (next: ThemeInputs) => {
    setState(next);
    pendingRef.current = next;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      // Always use the latest pending state, not the closure-captured `next`.
      const latest = pendingRef.current!;
      pendingRef.current = null;
      setRafState(latest);
    });
  };

  // Cancel a pending rAF on unmount so a scheduled setRafState can't fire after
  // the component is gone (observable in Strict Mode dev / hot-reload).
  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  const toggleMode = () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    document.documentElement.classList.toggle("mode-dark", next === "dark");
  };

  const onSave = async () => {
    try {
      const res = await fetch("/__save-theme", {
        method: "POST",
        body: serializeConfig(state),
      });
      // type is a top-level field on the toast object (rc.0 API).
      // Toast.Root automatically sets data-type from toast.type.
      toast.add({ title: res.ok ? "Saved ✓" : "Save failed", type: res.ok ? "success" : "error" });
    } catch {
      toast.add({ title: "Save failed", type: "error" });
    }
  };

  const onCopyFigma = async () => {
    const ok = await copyTokensForFigma(state);
    toast.add({ title: ok ? "Copied ✓" : "Copy failed", type: ok ? "success" : "error" });
  };

  const onResetAll = () => update(structuredClone(baseline));

  return (
    <div id="app">
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
      <Preview state={rafState} mode={mode} showContrast={showContrast} />
      <Toast.Portal>
        <Toast.Viewport className="toast-viewport">
          {toast.toasts.map((t) => (
            <Toast.Root key={t.id} toast={t} className="toast">
              <Toast.Title />
            </Toast.Root>
          ))}
        </Toast.Viewport>
      </Toast.Portal>
    </div>
  );
}

export default function App() {
  return (
    <Tooltip.Provider delay={150}>
      <Toast.Provider>
        <AppInner />
      </Toast.Provider>
    </Tooltip.Provider>
  );
}
