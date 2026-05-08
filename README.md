# Clockboard

Clockboard is a desktop browser extension that replaces the new tab page with a clean clock and countdown dashboard. It targets latest stable Chromium-family browsers and Firefox with Manifest V3.

## Features

- Large digital clock with seconds enabled by default.
- Localized date and automatic morning, afternoon, and evening greeting.
- Up to 20 saved future countdowns with smart units.
- Popup for quick countdown visibility and active countdown controls.
- Options page for clock preferences, countdown editing, reset, JSON export, and JSON import.
- System light/dark and accent color behavior with no theme picker.
- Browser sync storage with local fallback notice.
- No analytics, telemetry, remote assets, host permissions, or external network calls.

## Requirements

- Node 24 and npm 10 or newer.
- Latest stable Chrome, Edge, Brave, Opera, or Firefox for manual extension testing.
- Playwright browsers for local browser tests: `npx playwright install chromium`.

The current local workspace may run some scripts on Node 22, but CI and the project target Node 24.

## Development

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run package
```

`npm run package` builds Chromium and Firefox outputs, then writes store-ready archives and SHA-256 checksums to `artifacts/`.

## Browser Loading

Chromium-family browsers:

1. Run `npm run build:chromium`.
2. Open the browser extension manager.
3. Enable developer mode.
4. Load unpacked extension from `dist/chromium`.

Firefox:

1. Run `npm run build:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Load temporary add-on from `dist/firefox/manifest.json`.

Firefox store signing still requires replacing the placeholder Gecko ID in `scripts/extension-manifest.mjs`.

## VS Code

The workspace includes recommended extensions, editor defaults, npm tasks, and launch profiles.

- `Debug Chromium extension` builds `dist/chromium` and launches Playwright's Chrome for Testing with that unpacked extension.
- `Debug Firefox extension` builds `dist/firefox` and uses the Firefox debug extension. Local Firefox executable/profile behavior can vary by machine.

## Release

Before submitting `0.1.0`:

- Replace the Firefox Gecko ID placeholder.
- Add final support contact details.
- Confirm whether the store requires a public homepage or privacy-policy URL beyond the store listing fields.
- Review `docs/store-listing.md`, `docs/privacy.md`, and `docs/release-checklist.md`.
- Run `npm run package` and submit the relevant zip from `artifacts/`.

## License

MIT. See `LICENSE`.
