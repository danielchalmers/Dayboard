# Clockboard

A polished new tab page for the times that matter.

Clockboard keeps live clocks and countdowns in one quiet vertical list. It follows the system theme, uses the system accent color, and chooses sensible time formatting automatically.

## Highlights

- Live clocks in any IANA time zone.
- Natural countdowns like `5 days, 3 hours from now`.
- New tab, popup, and options pages.
- System light/dark mode and accent color.
- MV3 builds for Chrome and Microsoft Edge.
- No UI framework. No Tailwind. No analytics.

## Develop

```sh
npm install
npm run dev
```

Load `build/chrome-mv3-dev` as an unpacked extension. For Edge:

```sh
npm run dev:edge
```

Load `build/edge-mv3-dev`.

## Debug In VS Code

Press F5 and choose `Debug Chrome extension` or `Debug Edge extension`.

Chrome debugging uses Chrome for Testing because Chrome stable no longer supports unpacked extensions through `--load-extension`. Install it once:

```sh
npx playwright install chromium
```

The launch config starts Plasmo, waits for the dev bundle, opens an isolated browser profile, and loads the extension.

## Verify

```sh
npm run verify
npm run build:edge
npm run e2e
```

## Package

```sh
npm run package
npm run package:edge
```

Store-ready zips are written to `build/`.

## Privacy

Clockboard only requests `storage`. It does not collect analytics, call external services, or send clock data anywhere.
