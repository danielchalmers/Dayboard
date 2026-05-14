# Clockboard

Clockboard is a Manifest V3 Chrome and Microsoft Edge extension that replaces the new tab page with a configurable board of live digital clocks and countdowns. It is built with Plasmo, TypeScript, and React without Tailwind or a component library.

## Features

- New tab dashboard with live clocks and countdowns.
- Popup summary for checking upcoming items quickly.
- Full options page for editing board items and display preferences.
- Browser storage sync through the MV3 `storage` permission.
- System color scheme support and browser accent color integration where available.
- Chrome and Edge build targets.

## Requirements

- Node.js 22 or newer.
- npm 11 or newer.
- Chrome or Microsoft Edge for local extension testing.

## Development

```sh
npm install
npm run dev
```

Load `build/chrome-mv3-dev` as an unpacked extension in Chrome. For Edge, run:

```sh
npm run dev:edge
```

and load `build/edge-mv3-dev`.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run e2e
```

`npm run verify` runs type checking, unit tests, and the Chrome production build.

## Packaging

```sh
npm run package
npm run package:edge
```

The packaged extension artifacts are written under `build/`.

## Publishing Notes

- Review the generated production manifest in `build/chrome-mv3-prod/manifest.json`.
- Verify all screenshots, descriptions, and privacy disclosures before store submission.
- Clockboard only requests `storage`; it does not collect analytics or make network requests.
