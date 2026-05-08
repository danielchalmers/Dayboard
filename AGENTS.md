# Agent Guide

## Project Intent

Clockboard is a minimal, release-oriented browser extension. Keep changes focused, typed, and easy to review. Prefer small feature-slice commits with detailed narrative messages.

## Commands

- Install: `npm install`
- Format check: `npm run format:check`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit tests: `npm run test:unit`
- Browser tests: `npm run test:e2e`
- Package: `npm run package`

Use Node 24 when possible. If local Node is older, note any engine warnings in the final report.

## Architecture

- Entry HTML files live at the repo root for Vite extension output paths.
- Svelte entrypoints live in `src/entries/`.
- Shared storage, settings, and time logic lives in `src/lib/`.
- Svelte UI components live in `src/ui/`.
- Extension assets and locales live in `src/extension/`.
- Build/package scripts live in `scripts/`.

## Constraints

- Do not add analytics, telemetry, host permissions, or remote assets.
- Keep storage compatible with `chrome.storage.sync`; preserve local fallback behavior.
- Keep countdowns future-only and capped at 20 unless the product plan changes.
- Do not commit generated `dist/`, `artifacts/`, reports, or browser profiles.
- If manifest fields change, update manifest tests and release docs in the same slice.
