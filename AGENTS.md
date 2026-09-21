# AGENTS.md

## Project

Dayboard is a WXT, TypeScript, and React Manifest V3 extension for Chrome and Microsoft Edge. It replaces the new tab page with a calm, responsive board of widgets — live clocks, natural-language countdowns (with optional progress bars and recurrence), sticky notes, rotating quotes, a stopwatch and timer, daily habits, and todo lists — with editing kept on the new tab page itself.

The product should feel premium, polished, quiet, and useful at a glance. The whole app "just works" with as few knobs as possible: favor automatic behavior over configuration, and remove an option whenever a good default can replace it.

## Product Direction

- Keep the primary experience as compact individual cards that stack on narrow screens and flow into multiple columns on wider screens. The responsive grid decides placement; there is no column setting. Widgets render at a single standard size.
- The board centers itself vertically in the viewport (clear of the omnibox suggestions that drop over the top of a new tab) and scrolls from the top once it outgrows the screen. There is no docking option.
- The header is the greeting, not a brand title: a time-of-day greeting (optionally personalized) as the hero, with the date beneath.
- The look is premium through restraint: solid colors (no gradients or glows), calm decelerating motion (no overshoot, squish, or spin), neutral shadows for depth, and hairline separators for structure. Color belongs to the cards and the kind chips, not to chrome effects.
- Dragging to rearrange is always on. The drag handle is the card's padded outer ring, so text and controls inside the card stay selectable. Menu-based reordering uses "Move back" / "Move next" — the grid flows in reading order, so "up/down" would be inaccurate.
- Use system theme colors and system accent behavior. Prefer `AccentColor` and `AccentColorText` with `Highlight` and `HighlightText` as fallbacks when Chromium does not expose accent colors.
- Each widget kind has one shared line icon (`WidgetIcon`) used in the add menu, the card's corner badge, and the edit dialog. The per-kind chip tint belongs to the edit dialog, where the chip stands for one card; the add menu tints every chip with the system accent instead, since it is a list of actions.
- Habits show the current week only, always Monday to Sunday, and any day up to today can be toggled from its own dot. Days that haven't arrived stay inert. Do not derive the first weekday from the locale: the browser cannot see the first-day-of-week a user picked in Windows or macOS, so `Intl.Locale` only reports what a region conventionally does and an en-US board was stuck on Sunday with no way to correct it. Do not add earlier weeks — a second row of dots makes the card ambiguous about which week is now. Never add a streak counter or score: a number that resets to zero turns a gentle nudge into a source of anxiety.
- Per-item color is limited to the curated preset picker (`ColorPresetPicker`); the first-run default board uses these presets to feel customized at a glance, and a newly created widget preselects a random colorful preset (never neutral slate). Do not add per-item seconds or 12-hour/24-hour controls.
- Clocks use the user's system time format through `Intl.DateTimeFormat`.
- Countdowns use natural language such as `5 days, 3 hours from now`. A countdown's `startAt` is the only switch between the two presentations: with a start it fills a progress bar, without one it reads as time remaining. New countdowns start from the moment they are added, so a bar is the default with nothing to configure. Do not reintroduce an explicit display setting.
- A todo card holds four tasks, typed and checked on the card itself the way a note is edited there. The cap is the widget rather than a limitation of it — every task is on screen and nothing scrolls — so do not raise it, add paging, or let the card grow. A full card drops its add field instead of disabling it, which says the list is full without a control or a line of copy.
- User-facing copy should be concise, warm, and not overly explanatory.
- Dialog titles should name the action and kind, such as `Edit countdown`, not the item name.
- Widgets can be archived — tucked behind a quiet "Show archived" toggle (by drag onto a drop zone, or via the context menu) and restored the same ways. Keep the active board the clear focus.
- Global options live in an overlay reached from a gear button and from the browser's Options link, and stay deliberately small: a greeting name, JSON export/import of the board, and quiet links to the GitHub project and its issues page for feedback. Do not add layout or behavior toggles there. A timer's optional finish chime is opt-in per timer, set in that timer's own dialog rather than globally.
- Any sound (e.g. the timer chime) must be opt-in and gentle; never autoplay audio.
- Keep permissions minimal. Dayboard should only need `storage`.

## Architecture

- WXT entrypoints live in `src/entrypoints` (`newtab` for the new tab page; a minimal `background` service worker that exists so MV3 registers one).
- The root `NewTabPage` component lives in `src/NewTabPage.tsx`; `src/entrypoints/newtab/main.tsx` mounts it.
- Shared logic lives in `src/lib`: time and countdowns (`time`), the page's shared clock (`clock`), stopwatch/timer (`timers`), quotes (`quotes`), habits (`habit`), todo lists (`todo`), the greeting (`greeting`), the optional Web Audio chime (`chime`), colors (`colors`), the widget registry (`widgets`), `types`, and `chrome.storage.sync` access (`storage`).
- Reusable React components live in `src/components`.
- Plain CSS lives in `src/styles/global.css`.
- Do not add Tailwind or a UI component library.
- The manifest is defined in `wxt.config.ts`, not a root `manifest.json` or `package.json`.
- Static icons live in `public/` and are copied to the build output as-is.
- Storage uses `chrome.storage.sync` with a `chrome.storage.onChanged` watch so open tabs and signed-in browsers stay in sync. Global `settings` are normalized to defaults on read (missing or malformed fields fall back) and widgets keep new fields optional for backward compatibility; there is otherwise no heavy versioning or migration layer. Writes are optimistic and roll back with a notice if the `set` fails (e.g. quota).
- The page keeps time through one shared clock (`src/lib/clock.ts`, read with `useNow`). Cards subscribe at the granularity they can show (clocks and countdowns by the minute, habits and quotes at local midnight, a stopwatch or timer by the second only while running), the store keeps a single timeout aimed at the next boundary of the finest one wanted, and it stops while the tab is hidden. Nothing above a card renders on a tick; do not reintroduce a page-level interval or pass `now` down as a prop.
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
- `npm run test:coverage`: run Vitest with a coverage report.
- `npm run build`: build Chrome MV3 production output to `.output/chrome-mv3`.
- `npm run build:edge`: build Edge MV3 production output to `.output/edge-mv3`.
- `npm run e2e`: run Playwright smoke tests.
- `npm run perf:idle`: measure what the built new tab page costs while idle (timer wakes, renderer CPU, per-process CPU, DOM mutations) across seeded boards; see `scripts/idle-perf.mjs`.
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
- One browser is shared per Playwright worker, with a fresh page per test, because launching Chromium with the extension costs roughly ten times what opening a page in a warm one does. A test that would dirty the profile for its neighbours takes `test.use({ ownBrowser: true })`; the one that drives a failed write on purpose takes `test.use({ expectsSaveError: true })`, since an auto fixture otherwise fails any test that trips the `chrome.storage.sync` write quota.
- The Playwright context is pinned to `en-US` and `UTC`, so the board's `Intl` output is the same on every machine. Fake a clock with an explicit instant (`new Date("2026-03-04T10:00:00Z")`), never with local components, because Node's time zone is no longer the browser's.
- Reach for the shared Playwright helpers rather than rebuilding them: `cardByTitle`, `boxOf`, `readWidgetSettings`, and `DEFAULT_BOARD_TITLES` in `e2e/helpers.ts`, and the spec-local `addWidget`/`openWidgetMenu`/`dragWidget`. A test that needs to assert mid-flow, or that drives the pointer at computed coordinates to check menu placement, should still write its steps out.
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
