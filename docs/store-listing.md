# Store Listing Draft

## Name

Clockboard

## Short Description

A calm new tab clockboard with ordered countdown widgets.

## Long Description

Clockboard replaces your new tab page with a centered board of time widgets for the current time, date, greeting, and selected countdowns.

Use Options to drag items into the order you want, hide items you do not need, add future countdowns, reset settings, and import or export your configuration. The toolbar popup shows a compact mini version of the same ordered board.

Clockboard follows your system light or dark appearance and browser accent behavior. It does not include analytics, telemetry, remote assets, search changes, host permissions, or external network calls.

## Permission Rationale

- `storage`: saves clock preferences, Clockboard item order/visibility, and countdowns. Sync storage is used when available, with local storage fallback.

## Screenshot Plan

Run:

```bash
npm run screenshots
```

Expected outputs:

- `artifacts/screenshots/newtab.png`
- `artifacts/screenshots/popup.png`
- `artifacts/screenshots/options.png`

Review screenshots before submission to confirm text fits, system colors render correctly, the new tab is a single ordered list, and no browser test state should be cleared.

## Release TODO

- Support contact.
- Public homepage/privacy URL if required by the target store.
