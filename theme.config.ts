type ThemeInputs = import("./src/engine/types.js").ThemeInputs;

const themeInputs: ThemeInputs = {
  "neutral": {
    "hue": 208,
    "chroma": 0.01
  },
  "contrast": 0.5,
  "accents": {
    "primary": {
      "hue": 208,
      "chroma": 0.15
    },
    "secondary": {
      "hue": 10,
      "chroma": 0.2
    },
    "tertiary": {
      "hue": 211,
      "chroma": 0.055
    }
  },
  "status": {
    "success": {
      "hue": 139,
      "chroma": 0.2
    },
    "error": {
      "hue": 25,
      "chroma": 0.2
    },
    "warning": {
      "hue": 82,
      "chroma": 0.235
    },
    "info": {
      "hue": 264,
      "chroma": 0.225
    }
  },
  "brand": {
    "primary": {
      "l": 0.7276923816199479,
      "c": 0.11036100150581589,
      "h": 207.9703862815169
    },
    "secondary": {
      "l": 0.6295612946190623,
      "c": 0.2061587449830343,
      "h": 10.448707527778373
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
  "alpha": true
};

export default themeInputs;
