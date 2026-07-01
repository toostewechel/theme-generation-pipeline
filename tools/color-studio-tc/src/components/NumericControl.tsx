import { Slider, ControlFieldLabelHelpProvider } from "@ui";

interface NumericControlProps {
  name: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (v: number) => void;
  format?: (v: number) => string;
  help?: string;
  markerCount?: number;
}

export function NumericControl({
  name, min, max, step, value, onValueChange, format = String, help, markerCount,
}: NumericControlProps) {
  const slider = (
    <Slider
      name={name}
      min={min}
      max={max}
      step={step}
      value={value}
      valueLabel={format(value)}
      markerCount={markerCount}
      onValueChange={(v) => onValueChange(v)}
    />
  );
  return help ? (
    <ControlFieldLabelHelpProvider help={help} label={name}>
      {slider}
    </ControlFieldLabelHelpProvider>
  ) : (
    slider
  );
}
