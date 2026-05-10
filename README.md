# Clockboard [![Privacy Policy](https://img.shields.io/badge/privacy-policy-blue.svg)](PRIVACY_POLICY.md) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A calm new tab clockboard for Chromium browsers, with a user-ordered stack of time, date, greeting, and countdown widgets.

## Usage

### Arrange The Board

1. Open the Clockboard icon → **Options**
2. Drag widgets into the order you want
3. Toggle any widget on or off
4. Open a new tab

### Add Countdowns

1. Open **Options**
2. Add a future event name, date, and time
3. Save it
4. The countdown is added to the board automatically

## Development

Use `npm run dev` for local Vite development, `npm run check` before opening a PR, and `npm run package` to build the Chromium zip in `artifacts/`.

## Privacy

Clockboard stores settings and countdowns in browser extension storage. It has no analytics, telemetry, remote assets, external network calls, or host permissions.

## License

MIT. See `LICENSE`.
