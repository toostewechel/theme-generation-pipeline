import { useState } from "react";
import { Panel, PanelSection, Slider } from "@ui";

export default function App() {
  const [v, setV] = useState(50);
  return (
    <div style={{ padding: 20 }}>
      <Panel title="Smoke Test">
        <PanelSection title="Group">
          <Slider name="Value" min={0} max={100} step={1} value={v} onValueChange={setV} />
        </PanelSection>
      </Panel>
    </div>
  );
}
