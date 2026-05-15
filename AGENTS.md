# AGENTS.md

## Project

Clockboard is a Plasmo, TypeScript, and React Manifest V3 extension for Chrome and Microsoft Edge. It replaces the new tab page with a calm vertical list of live clocks and natural-language countdowns, with editing kept on the new tab page itself.

The product should feel polished, quiet, and useful at a glance. Favor clarity and automatic behavior over configuration-heavy UI.

## Product Direction

- Keep the primary experience as a flat vertical list, not a grid of cards.
- Use system theme colors and system highlight/accent behavior. In CSS, prefer `Highlight` and `HighlightText`; `AccentColor` did not resolve reliably in Chromium screenshots.
- Do not add per-item color, seconds, or 12-hour/24-hour controls.
- Clocks use the user's system time format through `Intl.DateTimeFormat`.
- Countdowns use natural language such as `5 days, 3 hours from now`.
- User-facing copy should be concise, warm, and not overly explanatory.
- The README follows a store-listing style: badge header, brief value statement, usage, credits.
- Keep permissions minimal. Clockboard should only need `storage`.

## Architecture

- Plasmo entry files live in `src/`:
  - `src/newtab.tsx`
- Shared time, storage, and item logic lives in `src/lib`.
- Reusable React components live in `src/components`.
- Plain CSS lives in `src/styles/global.css`.
- Do not add Tailwind or a UI component library.
- The Plasmo manifest override lives in `package.json`, not a root `manifest.json`.
- Keep the extension new-tab-only for this phase; do not reintroduce popup or options manifest entries.
- Keep checked-in local versions at `0.0.0` in both `package.json.version` and `package.json.manifest.version`.
- Keep support for both Chrome and Edge MV3 builds.

## Commands

- `npm run dev`: start the Chrome MV3 Plasmo dev build.
- `npm run dev:edge`: start the Edge MV3 Plasmo dev build.
- `npm run typecheck`: run TypeScript.
- `npm test`: run Vitest.
- `npm run build`: build Chrome MV3 production output.
- `npm run build:edge`: build Edge MV3 production output.
- `npm run e2e`: run Playwright smoke tests.
- `npm run verify`: run typecheck, unit tests, and Chrome build.
- `npm run package`: package the Chrome MV3 production build.
- `npm run package:edge`: package the Edge MV3 production build.

## VS Code Debugging

- F5 uses `.vscode/launch.json` and `.vscode/tasks.json`.
- The launch configs should run the matching Plasmo dev task before launching the browser.
- Chrome debugging uses Chrome for Testing from Playwright because Chrome-branded stable builds may ignore `--load-extension`.
- Edge debugging uses the local Edge executable.
- Keep debug browser profiles ignored under `.vscode/`.

## Testing Expectations

- For domain or UI behavior changes, update Vitest coverage.
- For page-level behavior changes, update Playwright coverage.
- Before handoff after frontend work, run:
  - `npm run verify`
  - `npm run build:edge`
  - `npm run e2e`
- For visual revamps, inspect built-page screenshots at desktop and mobile new-tab sizes.

## CI And Release

- CI is split into typecheck, unit, Chrome/Edge build matrix, and Playwright jobs.
- CI uses Node 24 and npm cache.
- The Playwright job uses the Microsoft Playwright container.
- Release runs on `vX.Y.Z` tags.
- Release patches both `package.json.version` and `package.json.manifest.version`.
- Do not manually bump checked-in version numbers for releases; the release workflow stamps them from the tag.
- Release builds and packages both browser targets.
- Release artifacts should be named:
  - `clockboard-chrome-${version}.zip`
  - `clockboard-edge-${version}.zip`
- Prefer descriptive, sentence-style commit subjects without conventional-commit prefixes.
- Commit bodies should explain the reasoning behind the change.

## Style Rules

- Use React function components and TypeScript.
- Prefer small, testable helpers for time calculations and storage migration.
- Avoid broad abstractions unless they remove real duplication.
- Keep layout stable at mobile and desktop widths.
- Use semantic controls and accessible labels.
- Keep buttons and form controls native-feeling, crisp, and restrained.
- Do not introduce analytics, network calls, or broad extension permissions.
