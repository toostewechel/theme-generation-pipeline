import themeInputs from "@project/theme.config.js";
import type { ThemeInputs } from "@project/src/engine/index.js";
import { Preview } from "./components/Preview.js";

export default function App() {
  const state = structuredClone(themeInputs) as ThemeInputs;
  return (
    <div id="app">
      <aside id="sidebar">Color Studio</aside>
      <Preview state={state} mode="light" />
    </div>
  );
}
