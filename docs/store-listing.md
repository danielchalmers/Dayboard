# Store Listing Draft

## Name

Clockboard

## Short Description

A clean new tab clock and countdown dashboard.

## Long Description

Clockboard replaces your new tab page with a focused clock dashboard for the current time and the events you are counting down to.

It includes a large digital clock, localized date, automatic time-of-day greeting, and a calm countdown display. Use the toolbar popup for quick controls, or open the options page to manage preferences, add countdowns, reset settings, and import or export your configuration.

Clockboard follows your system light or dark appearance and browser accent behavior. It does not include analytics, telemetry, remote assets, search changes, host permissions, or external network calls.

## Permission Rationale

- `storage`: saves clock preferences, countdowns, and the active countdown selection. Sync storage is used when available, with local storage fallback.

## Screenshot Plan

Run:

```bash
npm run screenshots
```

Expected outputs:

- `artifacts/screenshots/newtab.png`
- `artifacts/screenshots/popup.png`
- `artifacts/screenshots/options.png`

Review screenshots before submission to confirm text fits, system colors render correctly, and no browser test state should be cleared.

## Release TODO

- Support contact.
- Public homepage/privacy URL if required by the target store.
