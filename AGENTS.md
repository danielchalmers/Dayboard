# AGENTS.md - Clockboard

Keep this file short and repo-specific. Use it as a routing layer for agents, not as a second copy of repository config.

## Source-Of-Truth Files

- Product overview and user workflow: `README.md`
- Manifest generation and permissions: `scripts/extension-manifest.ts`
- Package scripts and engines: `package.json`
- Build/package pipeline: `vite.config.ts`, `scripts/package-extension.mjs`
- Shared settings, storage, and time logic: `src/lib/`
- New tab, popup, and options UI: `src/ui/`
- CI expectations: `.github/workflows/ci.yml`
- Tag release workflow: `.github/workflows/release.yml`
- Privacy policy: `PRIVACY_POLICY.md`

## Repository Map

- Root HTML files are Vite extension entrypoints.
- `src/entries/` mounts Svelte entrypoints.
- `src/lib/` owns typed settings, storage, countdown validation, and time formatting.
- `src/ui/` owns Svelte components.
- `src/extension/` contains icons and locale strings.
- `scripts/` owns manifest generation, icon generation, and packaging.

## Agent Workflow

1. Read the relevant source-of-truth files first.
2. Keep changes focused, typed, and easy to review.
3. Prefer the shared logic in `src/lib/` over duplicating storage, settings, or time behavior in UI components.
4. Validate with the existing npm scripts from `package.json`.
5. If local Node is older than 24, note any engine warnings in the final report.

## Development Commands

- Install: `npm install`
- Dev server: `npm run dev`
- Fast checks: `npm run check:fast`
- Full validation: `npm run check`
- Package Chromium zip/checksum: `npm run package`
- Browser loading: run `npm run build`, then load `dist/chromium` unpacked.

## Release Workflow

- Keep `package.json` and the generated local manifest at version `0.0.0`.
- Release from tags shaped `vX.Y.Z`.
- `.github/workflows/release.yml` patches npm metadata from the tag, runs `npm run check`, then attaches the Chromium zip and checksum to the GitHub Release.
- Before tagging, manually load `dist/chromium` and confirm store support contact, homepage, and privacy URL requirements.

## Extension Reminders

- Manifest V3 must stay Chromium-focused for v1.
- Do not add analytics, telemetry, host permissions, or remote assets.
- Keep settings compatible with `chrome.storage.sync` and preserve local fallback behavior.
- Keep countdowns future-only and capped at 20 unless the product plan changes.
- Do not commit generated `dist/`, `artifacts/`, coverage, reports, test results, or browser profiles.
- If manifest fields change, update manifest tests and README/privacy text in the same slice.

## When Updating This File

Only add durable repo-wide guidance here. If a detail already lives in a committed config or source file, link to that file instead of copying it.
