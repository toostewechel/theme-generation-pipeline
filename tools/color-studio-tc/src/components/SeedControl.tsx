import { useEffect, useRef, useState } from "react";
import { oklch } from "culori";
import type { HueSeed, Oklch } from "@project/src/engine/index.js";
import { NumericControl } from "./NumericControl.js";
import { HueWheel } from "./HueWheel.js";
import { hexOf, parseHex, swatchCss, REP_L } from "../lib/controls-math.js";

interface SeedControlProps {
  name: string;
  seed: HueSeed;
  onSeed: (seed: HueSeed, source?: Oklch) => void;
  onRemove?: () => void;
}

export function SeedControl({ name, seed, onSeed, onRemove }: SeedControlProps) {
  const [displayL, setDisplayL] = useState(REP_L);
  const [hexBad, setHexBad] = useState(false);
  const badTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hexValue = hexOf(seed.hue, seed.chroma, displayL);

  useEffect(() => () => { if (badTimer.current) clearTimeout(badTimer.current); }, []);

  const emit = (next: HueSeed, source?: Oklch) => onSeed(next, source);

  const onHexCommit = (raw: string) => {
    const parsed = parseHex(raw);
    const exact = oklch(raw.trim());
    if (!parsed || !exact) {
      setHexBad(true);
      if (badTimer.current) clearTimeout(badTimer.current);
      badTimer.current = setTimeout(() => setHexBad(false), 900);
      return;
    }
    setDisplayL(parsed.l);
    emit({ hue: parsed.hue, chroma: parsed.chroma }, { l: exact.l!, c: exact.c ?? 0, h: exact.h ?? 0 });
  };

  return (
    <div>
      <div className="cs-seed-head">
        <span className="cs-swatch"><i style={{ background: swatchCss(displayL, seed.hue, seed.chroma) }} /></span>
        <span className="cs-seed-name">{name}</span>
        <input
          className={"cs-hex" + (hexBad ? " cs-hex--bad" : "")}
          type="text" spellCheck={false} defaultValue={hexValue} key={hexValue}
          onBlur={(e) => onHexCommit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          title="Paste a brand hex — hue & chroma seed the ramp; the lightness shown just echoes your paste"
        />
        <HueWheel hue={seed.hue} />
        {onRemove && (
          <button type="button" className="cs-seed-remove" onClick={onRemove}
            aria-label={`Remove ${name} accent`} title={`Remove ${name} accent`}>×</button>
        )}
      </div>
      <NumericControl
        name="Hue" min={0} max={360} step={1} value={seed.hue}
        format={(v) => `${v}°`}
        help="Drag right to walk the color wheel — warm reds → greens → cool blues."
        onValueChange={(v) => emit({ hue: v, chroma: seed.chroma })}
      />
      <NumericControl
        name="Chroma" min={0} max={0.3} step={0.005} value={seed.chroma}
        format={(v) => v.toFixed(3)}
        help="Drag right for more vivid; left fades toward gray."
        onValueChange={(v) => emit({ hue: seed.hue, chroma: v })}
      />
    </div>
  );
}
