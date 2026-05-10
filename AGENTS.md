# AGENTS.md - Clockboard

Keep this file short and repo-specific. Use it as a routing layer for agents, not as a second copy of repository config.

## Source-Of-Truth Files

- Product overview and development workflow: `README.md`
- Manifest generation and permissions: `scripts/extension-manifest.ts`
- Package scripts and engines: `package.json`
- Build/package pipeline: `vite.config.ts`, `scripts/package-extension.mjs`
- Shared settings, storage, and time logic: `src/lib/`
- New tab, popup, and options UI: `src/ui/`
- CI expectations: `.github/workflows/ci.yml`
- Tag release workflow: `.github/workflows/release.yml`
- Privacy policy: `PRIVACY_POLICY.md`

## Agent Workflow

1. Read the relevant source-of-truth files first.
2. Keep changes focused, typed, and easy to review.
3. Prefer the shared logic in `src/lib/` over duplicating storage, settings, or time behavior in UI components.
4. Validate with the npm scripts in `package.json`.
5. If local Node is older than 24, note any engine warnings in the final report.

## Extension Reminders

- Manifest V3 must stay Chromium-focused for v1.
- Keep local package and manifest version at `0.0.0`; release workflow sets the real version from `vX.Y.Z` tags.
- Do not add analytics, telemetry, host permissions, or remote assets.
- Keep settings compatible with `chrome.storage.sync` and preserve local fallback behavior.
- Keep countdowns future-only and capped at 20 unless the product plan changes.
- Do not commit generated `dist/`, `artifacts/`, coverage, reports, test results, or browser profiles.
- If manifest fields change, update manifest tests and README/privacy text in the same slice.
