import type { WidgetColorPreset } from "./types"

export interface ColorPresetTheme {
  bg: string
  tint: string
  border: string
  accent: string
}

export interface ColorPresetDefinition {
  id: WidgetColorPreset
  label: string
  light: ColorPresetTheme
  dark: ColorPresetTheme
}

export const COLOR_PRESETS: ColorPresetDefinition[] = [
  {
    id: "slate",
    label: "Slate",
    light: {
      bg: "hsl(210, 20%, 98%)",
      tint: "hsl(215, 16%, 47%)",
      border: "hsl(220, 13%, 91%)",
      accent: "hsl(215, 25%, 27%)"
    },
    dark: {
      bg: "hsl(215, 15%, 12%)",
      tint: "hsl(215, 10%, 65%)",
      border: "hsl(215, 12%, 18%)",
      accent: "hsl(215, 20%, 80%)"
    }
  },
  {
    id: "rose",
    label: "Rose",
    light: {
      bg: "hsl(350, 60%, 98%)",
      tint: "hsl(350, 40%, 45%)",
      border: "hsl(350, 40%, 92%)",
      accent: "hsl(350, 60%, 35%)"
    },
    dark: {
      bg: "hsl(350, 40%, 11%)",
      tint: "hsl(350, 45%, 70%)",
      border: "hsl(350, 30%, 18%)",
      accent: "hsl(350, 60%, 75%)"
    }
  },
  {
    id: "amber",
    label: "Amber",
    light: {
      bg: "hsl(40, 70%, 97%)",
      tint: "hsl(35, 60%, 35%)",
      border: "hsl(40, 50%, 90%)",
      accent: "hsl(35, 75%, 30%)"
    },
    dark: {
      bg: "hsl(35, 40%, 10%)",
      tint: "hsl(35, 45%, 65%)",
      border: "hsl(35, 30%, 17%)",
      accent: "hsl(35, 60%, 70%)"
    }
  },
  {
    id: "emerald",
    label: "Emerald",
    light: {
      bg: "hsl(145, 45%, 98%)",
      tint: "hsl(150, 45%, 30%)",
      border: "hsl(145, 30%, 91%)",
      accent: "hsl(150, 55%, 25%)"
    },
    dark: {
      bg: "hsl(150, 35%, 10%)",
      tint: "hsl(150, 40%, 65%)",
      border: "hsl(150, 25%, 17%)",
      accent: "hsl(150, 50%, 70%)"
    }
  },
  {
    id: "sky",
    label: "Sky",
    light: {
      bg: "hsl(200, 70%, 98%)",
      tint: "hsl(200, 60%, 40%)",
      border: "hsl(200, 40%, 91%)",
      accent: "hsl(200, 75%, 30%)"
    },
    dark: {
      bg: "hsl(200, 45%, 11%)",
      tint: "hsl(200, 40%, 70%)",
      border: "hsl(200, 30%, 18%)",
      accent: "hsl(200, 60%, 75%)"
    }
  },
  {
    id: "violet",
    label: "Violet",
    light: {
      bg: "hsl(265, 50%, 98%)",
      tint: "hsl(265, 45%, 45%)",
      border: "hsl(265, 30%, 92%)",
      accent: "hsl(265, 60%, 35%)"
    },
    dark: {
      bg: "hsl(265, 35%, 12%)",
      tint: "hsl(265, 40%, 72%)",
      border: "hsl(265, 25%, 18%)",
      accent: "hsl(265, 55%, 78%)"
    }
  },
  {
    id: "teal",
    label: "Teal",
    light: {
      bg: "hsl(175, 40%, 98%)",
      tint: "hsl(175, 50%, 30%)",
      border: "hsl(175, 30%, 91%)",
      accent: "hsl(175, 60%, 25%)"
    },
    dark: {
      bg: "hsl(175, 35%, 10%)",
      tint: "hsl(175, 40%, 65%)",
      border: "hsl(175, 25%, 17%)",
      accent: "hsl(175, 50%, 70%)"
    }
  },
  {
    id: "coral",
    label: "Coral",
    light: {
      bg: "hsl(15, 70%, 98%)",
      tint: "hsl(15, 55%, 45%)",
      border: "hsl(15, 40%, 92%)",
      accent: "hsl(15, 70%, 35%)"
    },
    dark: {
      bg: "hsl(15, 40%, 11%)",
      tint: "hsl(15, 45%, 70%)",
      border: "hsl(15, 25%, 18%)",
      accent: "hsl(15, 60%, 75%)"
    }
  },
  {
    id: "indigo",
    label: "Indigo",
    light: {
      bg: "hsl(230, 55%, 98%)",
      tint: "hsl(230, 50%, 45%)",
      border: "hsl(230, 40%, 92%)",
      accent: "hsl(230, 65%, 35%)"
    },
    dark: {
      bg: "hsl(230, 35%, 12%)",
      tint: "hsl(230, 40%, 72%)",
      border: "hsl(230, 25%, 19%)",
      accent: "hsl(230, 55%, 78%)"
    }
  },
  {
    id: "mint",
    label: "Mint",
    light: {
      bg: "hsl(120, 40%, 98%)",
      tint: "hsl(125, 45%, 35%)",
      border: "hsl(120, 30%, 91%)",
      accent: "hsl(125, 55%, 25%)"
    },
    dark: {
      bg: "hsl(125, 30%, 10%)",
      tint: "hsl(125, 35%, 68%)",
      border: "hsl(125, 20%, 17%)",
      accent: "hsl(125, 45%, 72%)"
    }
  }
]

export const getPresetById = (id: WidgetColorPreset): ColorPresetDefinition => {
  return COLOR_PRESETS.find((preset) => preset.id === id) || COLOR_PRESETS[0]!
}

export const getPresetCssVars = (id: WidgetColorPreset): Record<string, string> => {
  const preset = getPresetById(id)
  return {
    "--card-bg-light": preset.light.bg,
    "--card-tint-light": preset.light.tint,
    "--card-border-light": preset.light.border,
    "--card-accent-light": preset.light.accent,
    "--card-bg-dark": preset.dark.bg,
    "--card-tint-dark": preset.dark.tint,
    "--card-border-dark": preset.dark.border,
    "--card-accent-dark": preset.dark.accent
  }
}
