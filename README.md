# Clockboard [![Privacy Policy](https://img.shields.io/badge/privacy-policy-blue.svg)](PRIVACY_POLICY.md) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Clockboard is a Chromium desktop extension that replaces the new tab page with a calm, user-ordered board of time widgets.

## Features

- Centered Clockboard list on the new tab page.
- Uniform soft panels for current time, date/greeting, and selected countdowns.
- Drag-and-drop ordering and visibility controls in Options.
- Up to 20 saved future countdowns, automatically added to the board.
- Compact popup mini-list that mirrors the ordered board.
- Locale-aware clock with seconds enabled by default and 12/24-hour override.
- System light/dark and system accent behavior with no theme picker.
- Browser sync storage with local fallback notice.
- No analytics, telemetry, remote assets, external network calls, or host permissions.

## Requirements

- Node 24 and npm 10 or newer.
- Latest stable Chrome, Edge, Brave, or Opera for manual testing.
- Playwright Chromium for browser tests: `npx playwright install chromium`.

## Development

```bash
npm install
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run package
```

`npm run check` runs formatting, linting, typechecking, unit tests, browser tests, and packaging.

`npm run package` builds the Chromium output, then writes the extension zip and SHA-256 checksum to `artifacts/`. Local builds intentionally use version `0.0.0`; release builds get their version from the pushed Git tag.

## Browser Loading

1. Run `npm run build`.
2. Open a Chromium-family browser extension manager.
3. Enable developer mode.
4. Load the unpacked extension from `dist/chromium`.

## VS Code

The workspace includes recommended extensions, editor defaults, npm tasks, and a Chromium extension launch profile.

## Release

Release from a Git tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

The release workflow validates the tag, patches `package.json` and the generated manifest to `X.Y.Z`, runs checks, packages the Chromium extension, and attaches the zip plus SHA-256 checksum to the GitHub Release.

Before tagging, run `npm run check`, review `dist/chromium/manifest.json`, load the unpacked extension manually, and confirm target-store support contact, homepage, and privacy URL requirements.

## License

MIT. See `LICENSE`.
