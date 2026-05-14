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

## VS Code Debugging

Use the Run and Debug view or press F5, then choose `Debug Chrome extension` or `Debug Edge extension`.

The debug configurations use standard VS Code browser launch settings:

- `preLaunchTask` starts the matching Plasmo dev task.
- The Plasmo task waits for the `Extension re-packaged` message before VS Code launches the browser.
- The browser launches with an isolated profile under `.vscode/`.
- `--disable-extensions-except` and `--load-extension` point at the generated Plasmo dev bundle.

For Chrome, the launch config targets Chrome for Testing from Playwright because current Chrome-branded stable builds no longer support loading unpacked extensions with `--load-extension`. Install it once from VS Code by running the `Install Chrome for Testing` task, or from a terminal:

```sh
npx playwright install chromium
```

If Playwright updates its browser revision, update `runtimeExecutable` in `.vscode/launch.json` to the new `chrome.exe` under `%LOCALAPPDATA%\ms-playwright\chromium-*/chrome-win64/`.

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
