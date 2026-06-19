# AGENTS.md

## Project

Dayboard is a WXT, TypeScript, and React Manifest V3 extension for Chrome and Microsoft Edge. It replaces the new tab page with a calm, responsive board of widgets — live clocks, natural-language countdowns (with optional progress bars and recurrence), sticky notes, rotating quotes, a stopwatch and timer, and habit streaks — with editing kept on the new tab page itself.

The product should feel polished, quiet, and useful at a glance. Favor clarity and automatic behavior over configuration-heavy UI.

## Product Direction

- Keep the primary experience as compact individual cards that stack on narrow screens and flow into multiple columns on wider screens (Auto by default, or a fixed 1–4 via options). A widget may opt into a wide size that spans two columns.
- Use system theme colors and system accent behavior. Prefer `AccentColor` and `AccentColorText` with `Highlight` and `HighlightText` as fallbacks when Chromium does not expose accent colors.
- Per-item color is limited to the curated preset picker (`ColorPresetPicker`); the first-run default board uses these presets to feel customized at a glance. Do not add per-item seconds or 12-hour/24-hour controls.
- Clocks use the user's system time format through `Intl.DateTimeFormat`.
- Countdowns use natural language such as `5 days, 3 hours from now`.
- User-facing copy should be concise, warm, and not overly explanatory.
- Dialog titles should name the action and kind, such as `Edit countdown`, not the item name.
- Widgets can be archived — tucked behind a quiet "Show archived" toggle (by drag onto a drop zone, or via the context menu) and restored the same ways. Keep the active board the clear focus.
- Global options live in an overlay reached from a gear button and from the browser's Options link: a greeting name, drag-to-rearrange, column count, and an opt-in timer chime, plus JSON export/import of the board.
- Any sound (e.g. the timer chime) must be opt-in and gentle; never autoplay audio.
- Keep permissions minimal. Dayboard should only need `storage`.

## Architecture

- WXT entrypoints live in `src/entrypoints` (`newtab` for the new tab page; a minimal `background` service worker that exists so MV3 registers one).
- The root `NewTabPage` component lives in `src/NewTabPage.tsx`; `src/entrypoints/newtab/main.tsx` mounts it.
- Shared logic lives in `src/lib`: time and countdowns (`time`), stopwatch/timer (`timers`), quotes (`quotes`), habits (`habit`), the greeting (`greeting`), the optional Web Audio chime (`chime`), colors (`colors`), the widget registry (`widgets`), `types`, and `chrome.storage.sync` access (`storage`).
- Reusable React components live in `src/components`.
- Plain CSS lives in `src/styles/global.css`.
- Do not add Tailwind or a UI component library.
- The manifest is defined in `wxt.config.ts`, not a root `manifest.json` or `package.json`.
- Static icons live in `public/` and are copied to the build output as-is.
- Storage uses `chrome.storage.sync` with a `chrome.storage.onChanged` watch so open tabs and signed-in browsers stay in sync. Global `settings` are normalized to defaults on read (missing or malformed fields fall back) and widgets keep new fields optional for backward compatibility; there is otherwise no heavy versioning or migration layer. Writes are optimistic and roll back with a notice if the `set` fails (e.g. quota).
- Keep the extension new-tab-only: no popup and no separate options entrypoint. The Options overlay lives on the new tab page itself, which `options_ui` points at (`newtab.html?view=settings`).
- Keep the checked-in `package.json.version` at `0.0.0`; release builds set the manifest version from the `RELEASE_VERSION` environment variable.
- Keep support for both Chrome and Edge MV3 builds.

## Workflow

- Read the nearest relevant code before editing; preserve the existing structure unless the task requires changing it.
- Keep changes narrow and durable. Avoid broad abstractions unless they remove real duplication or make a rule testable.
- Prefer repository-local evidence over memory or chat context.
- If a rule becomes important enough to repeat, consider whether it belongs in a test, CI check, or script.

## Commands

- `npm run dev`: start the Chrome MV3 WXT dev server.
- `npm run dev:edge`: start the Edge MV3 WXT dev server.
- `npm run typecheck`: run TypeScript.
- `npm test`: run Vitest.
- `npm run build`: build Chrome MV3 production output to `.output/chrome-mv3`.
- `npm run build:edge`: build Edge MV3 production output to `.output/edge-mv3`.
- `npm run e2e`: run Playwright smoke tests.
- `npm run verify`: run typecheck, unit tests, and Chrome build.
- `npm run zip`: package the Chrome MV3 production build.
- `npm run zip:edge`: package the Edge MV3 production build.

## VS Code Debugging

- F5 uses `.vscode/launch.json` and `.vscode/tasks.json`.
- The launch configs start the WXT dev server (`npm run dev` / `npm run dev:edge`), which opens a browser with the extension loaded.
- Keep debug browser profiles ignored under `.vscode/`.

## Testing Expectations

- For domain or UI behavior changes, update Vitest coverage.
- For page-level behavior changes, update Playwright coverage.
- Playwright loads the built extension from `.output/chrome-mv3` via `launchPersistentContext` (`e2e/fixtures.ts`, built by `e2e/global-setup.ts`) and seeds state through `chrome.storage.sync`, not a served page.
- Before handoff after frontend work, run:
  - `npm run verify`
  - `npm run build:edge`
  - `npm run e2e`
- For visual revamps, inspect built-page screenshots at desktop and mobile new-tab sizes.
- Keep a seeded Playwright screenshot story for product-like CI artifacts covering the main board, mobile board, add dialogs, and edit dialogs.

## CI And Release

- CI is split into typecheck, unit, Chrome/Edge build matrix, and Playwright jobs.
- CI uses Node 24 and npm cache.
- The Playwright job uses the Microsoft Playwright container.
- Release runs on `vX.Y.Z` tags.
- The release workflow passes the tag version to the build via the `RELEASE_VERSION` environment variable, which `wxt.config.ts` writes into the manifest.
- Do not manually bump the checked-in `package.json.version`; the release workflow stamps the manifest version from the tag.
- Release zips and publishes both browser targets.
- Prefer descriptive, sentence-style commit subjects without conventional-commit prefixes.
- Commit bodies should explain the reasoning behind the change.

## Style Rules

- Use React function components and TypeScript.
- Prefer small, testable helpers.
- Avoid broad abstractions unless they remove real duplication.
- Keep layout stable at mobile and desktop widths.
- Use semantic controls and accessible labels.
- Keep buttons and form controls native-feeling, crisp, and restrained.
- Buttons should use a pointer cursor and should not move on hover.
- Dropdowns should close when clicking outside them or when selecting an action.
- Dialogs and message views should open centered in the viewport.
- Use subtle shadows for cards, dropdowns, and dialogs; avoid broad glow effects.
- Do not introduce analytics, network calls, or broad extension permissions.
