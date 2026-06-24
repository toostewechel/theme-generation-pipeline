import { useState } from "react";
import { oklch } from "culori";
import type { HueSeed, Oklch } from "@project/src/engine/index.js";
import { ParamSlider } from "./ParamSlider.js";
import { hexOf, parseHex, hueTrack, chromaTrack, swatchCss, REP_L } from "../lib/controls-math.js";

interface SeedControlProps {
  name: string;
  seed: HueSeed;
  onSeed: (seed: HueSeed, source: Oklch) => void;
}

export function SeedControl({ name, seed, onSeed }: SeedControlProps) {
  // displayL echoes a pasted hex's lightness; it never affects generation.
  const [displayL, setDisplayL] = useState(REP_L);
  const [hexBad, setHexBad] = useState(false);
  const hexValue = hexOf(seed.hue, seed.chroma, displayL);

  const emit = (next: HueSeed, source?: Oklch) =>
    onSeed(next, source ?? { l: displayL, c: next.chroma, h: next.hue });

  const onHexCommit = (raw: string) => {
    const parsed = parseHex(raw);
    const exact = oklch(raw.trim());
    if (!parsed || !exact) {
      setHexBad(true);
      setTimeout(() => setHexBad(false), 900);
      return;
    }
    setDisplayL(parsed.l);
    emit({ hue: parsed.hue, chroma: parsed.chroma }, { l: exact.l!, c: exact.c ?? 0, h: exact.h ?? 0 });
  };

  return (
    <div className="seed">
      <div className="seed-head">
        <span className="swatch"><i style={{ background: swatchCss(displayL, seed.hue, seed.chroma) }} /></span>
        <span className="seed-name">{name}</span>
        <input
          className={"hex" + (hexBad ? " hex--bad" : "")}
          type="text" spellCheck={false} defaultValue={hexValue} key={hexValue}
          onBlur={(e) => onHexCommit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          title="Paste a brand hex — hue & chroma seed the ramp; the lightness shown just echoes your paste"
        />
      </div>
      <ParamSlider
        name="Hue" min={0} max={360} step={1} value={seed.hue}
        trackStyle={hueTrack()} format={(v) => `${v}°`} editable
        help="Drag right to walk the color wheel — warm reds → greens → cool blues."
        onValueChange={(v) => emit({ hue: v, chroma: seed.chroma })}
      />
      <ParamSlider
        name="Chroma" min={0} max={0.3} step={0.005} value={seed.chroma}
        trackStyle={chromaTrack(seed.hue)} format={(v) => v.toFixed(3)} editable
        help="Drag right for more vivid; left fades toward gray."
        onValueChange={(v) => emit({ hue: seed.hue, chroma: v })}
      />
    </div>
  );
}
