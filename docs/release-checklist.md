# Release Checklist

## Preflight

- Use Node 24.
- Run `npm ci`.
- Run `npm run format:check`.
- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm run test:unit`.
- Run `npm run test:e2e`.
- Run `npm run package`.

## Store Artifacts

- Chromium zip: `artifacts/clockboard-chromium-v0.1.0.zip`
- Checksums: matching `.sha256` files in `artifacts/`
- Screenshots: `artifacts/screenshots/`

## Required Manual Gates

- Add final support contact.
- Confirm store privacy URL/homepage requirements.
- Review generated manifest in `dist/chromium/manifest.json`.
- Load the unpacked output manually before submission.

## Versioning

Initial public build is `0.1.0`. Bump `package.json` before producing a new submission package.
