# AGENTS.md

## Project

Clockboard is a Plasmo, TypeScript, and React MV3 browser extension for Chrome and Microsoft Edge. It provides live digital clocks and countdowns on the browser new tab page, plus a popup and options page.

## Commands

- `npm run dev`: start the Chrome MV3 Plasmo dev build.
- `npm run dev:edge`: start the Edge MV3 Plasmo dev build.
- `npm run typecheck`: run TypeScript.
- `npm test`: run Vitest.
- `npm run build`: build Chrome MV3 production output.
- `npm run build:edge`: build Edge MV3 production output.
- `npm run e2e`: run Playwright tests.
- `npm run verify`: run typecheck, unit tests, and Chrome build.

## Conventions

- Use React function components and TypeScript.
- Do not add a UI framework or Tailwind.
- Keep shared domain code under `src/lib`.
- Keep reusable React components under `src/components`.
- Keep styling in plain CSS files under `src/styles`.
- Prefer small, testable helpers for time calculations and storage migration.
- Keep extension permissions minimal.
- Preserve support for both Chrome and Edge MV3 builds.
