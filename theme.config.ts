type ThemeInputs = import("./src/engine/types.js").ThemeInputs;

const themeInputs: ThemeInputs = {
  "neutral": {
    "hue": 208,
    "chroma": 0.01
  },
  "contrast": 0.5,
  "accents": {
    "primary": {
      "hue": 151,
      "chroma": 0.19
    },
    "secondary": {
      "hue": 70,
      "chroma": 0.135
    },
    "tertiary": {
      "hue": 211,
      "chroma": 0.055
    }
  },
  "status": {
    "success": {
      "hue": 148,
      "chroma": 0.18
    },
    "error": {
      "hue": 40,
      "chroma": 0.185
    },
    "warning": {
      "hue": 65,
      "chroma": 0.195
    },
    "info": {
      "hue": 229,
      "chroma": 0.17
    }
  },
  "brand": {
    "primary": {
      "l": 0.7310174280259285,
      "c": 0.1899270724898951,
      "h": 151.20412619096845
    },
    "secondary": {
      "l": 0.8233495775263661,
      "c": 0.1328181454650469,
      "h": 69.92945706761948
    },
    "tertiary": {
      "l": 0.7338003346291935,
      "c": 0.056416291146257055,
      "h": 210.81794300425463
    }
  },
  "darkSurfaces": {
    "base": 0.095,
    "step": 0.034
  },
  "alpha": false
};

export default themeInputs;
