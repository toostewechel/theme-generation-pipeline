interface HueWheelProps {
  hue: number;
  size?: number;
}

// Rainbow conic gradient in OKLCH, matching the engine's hue axis (0–360°).
// `from 0deg` puts hue 0 at the top and increases clockwise, so a marker
// rotated `hue` degrees points at the matching color on the rim.
const CONIC = (() => {
  const stops: string[] = [];
  for (let h = 0; h <= 360; h += 15) stops.push(`oklch(0.7 0.16 ${h}) ${h}deg`);
  return `conic-gradient(from 0deg, ${stops.join(", ")})`;
})();

/** A tiny color compass: a hue wheel with a marker at the seed's current hue.
    Visual-only — shows which color a hue value maps to. */
export function HueWheel({ hue, size = 18 }: HueWheelProps) {
  return (
    <span
      className="cs-huewheel"
      style={{ width: size, height: size, backgroundImage: CONIC }}
      aria-hidden="true"
      title={`Hue ${Math.round(hue)}° on the color wheel`}
    >
      <span className="cs-huewheel-mark" style={{ transform: `rotate(${hue}deg)` }} />
    </span>
  );
}
