# AGENTS.md

## Project

Clockboard is a Plasmo, TypeScript, and React MV3 extension for Chrome and Microsoft Edge. It turns the new tab page into a calm vertical list of live clocks and natural-language countdowns.

## Commands

- `npm run dev`: start the Chrome MV3 Plasmo dev build.
- `npm run dev:edge`: start the Edge MV3 Plasmo dev build.
- `npm run typecheck`: run TypeScript.
- `npm test`: run Vitest.
- `npm run build`: build Chrome MV3 production output.
- `npm run build:edge`: build Edge MV3 production output.
- `npm run e2e`: run Playwright tests.
- `npm run verify`: run typecheck, unit tests, and Chrome build.

## Product Direction

- Keep the UI sleek, quiet, and scan-friendly.
- Aim for a premium, polished, modern product surface without ornamental clutter.
- Prefer board-level customization over per-item display knobs.
- Use system theme colors and `AccentColor`; avoid custom decorative palettes or gradients.
- Keep controls crisp, tactile, and responsive across new tab, options, and popup surfaces.
- Clocks use the user's system time format.
- Countdowns use natural language, not raw unit toggles.

## Conventions

- Use React function components and TypeScript.
- Do not add a UI framework or Tailwind.
- Keep shared domain code under `src/lib`.
- Keep reusable React components under `src/components`.
- Keep styling in plain CSS files under `src/styles`.
- Prefer small, testable helpers for time calculations and storage migration.
- Keep user-facing copy concise and warm without being wordy.
- Keep extension permissions minimal.
- Preserve support for both Chrome and Edge MV3 builds.
