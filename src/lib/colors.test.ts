import { describe, expect, it } from "vitest"
import { COLOR_PRESETS, getPresetById, getPresetCssVars } from "./colors"

describe("colors presets", () => {
  it("defines exactly 10 accessible presets", () => {
    expect(COLOR_PRESETS.length).toBe(10)
    
    const expectedPresetIds = [
      "slate",
      "rose",
      "amber",
      "emerald",
      "sky",
      "violet",
      "teal",
      "coral",
      "indigo",
      "mint"
    ]
    
    expect(COLOR_PRESETS.map((p) => p.id)).toEqual(expectedPresetIds)
  })

  it("retrieves a preset by ID or falls back to slate", () => {
    const rose = getPresetById("rose")
    expect(rose.label).toBe("Rose")

    // @ts-expect-error - testing invalid preset argument
    const fallback = getPresetById("invalid-preset-id")
    expect(fallback.id).toBe("slate")
  })

  it("generates correct CSS variable custom property mappings", () => {
    const cssVars = getPresetCssVars("emerald")
    
    expect(cssVars).toEqual({
      "--card-bg-light": "hsl(145, 45%, 98%)",
      "--card-tint-light": "hsl(150, 45%, 30%)",
      "--card-border-light": "hsl(145, 30%, 91%)",
      "--card-accent-light": "hsl(150, 55%, 25%)",
      "--card-bg-dark": "hsl(150, 35%, 10%)",
      "--card-tint-dark": "hsl(150, 40%, 65%)",
      "--card-border-dark": "hsl(150, 25%, 17%)",
      "--card-accent-dark": "hsl(150, 50%, 70%)"
    })
  })
})
