import type { WidgetColorPreset } from "~/lib/types"
import { COLOR_PRESETS } from "~/lib/colors"

interface ColorPresetPickerProps {
  value: WidgetColorPreset
  onChange: (preset: WidgetColorPreset) => void
}

export const ColorPresetPicker = ({ value, onChange }: ColorPresetPickerProps) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      nextIndex = (index + 1) % COLOR_PRESETS.length
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      nextIndex = (index - 1 + COLOR_PRESETS.length) % COLOR_PRESETS.length
    } else {
      return
    }

    const nextPreset = COLOR_PRESETS[nextIndex]
    if (nextPreset) {
      onChange(nextPreset.id)
      const element = document.getElementById(`preset-swatch-${nextPreset.id}`)
      element?.focus()
    }
  }

  return (
    <div className="color-preset-field">
      <span className="color-preset-label">Theme color</span>
      <div className="color-preset-picker" role="radiogroup" aria-label="Widget theme color">
        {COLOR_PRESETS.map((preset, index) => {
          const isSelected = value === preset.id
          return (
            <button
              key={preset.id}
              id={`preset-swatch-${preset.id}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={preset.label}
              className={`color-swatch color-swatch--${preset.id}${
                isSelected ? " color-swatch--selected" : ""
              }`}
              onClick={() => onChange(preset.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              tabIndex={isSelected ? 0 : -1}
              style={{
                "--swatch-color-light": preset.light.accent,
                "--swatch-color-dark": preset.dark.accent
              } as React.CSSProperties}
            />
          )
        })}
      </div>
    </div>
  )
}
