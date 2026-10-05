# Dayboard

[![Chrome Web Store version](https://img.shields.io/chrome-web-store/v/gldaglgodbdhnpjjnoocfnclmdejpaii?label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/gldaglgodbdhnpjjnoocfnclmdejpaii)
[![Build status](https://img.shields.io/github/actions/workflow/status/danielchalmers/Dayboard/ci.yml?label=build)](https://github.com/danielchalmers/Dayboard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/danielchalmers/Dayboard/blob/main/LICENSE)

Dayboard is a new tab page for Chrome and Edge. It replaces the blank tab with a board of small widgets (clocks, countdowns, timers, stopwatches, notes, todo lists, habit trackers, quotes) so a new tab can show the few things you want to keep an eye on.

It's a free, open-source browser extension. Everything is stored locally and it makes no network requests.

<img width="1280" height="800" alt="Dayboard new tab page" src="https://github.com/user-attachments/assets/faba12fc-b6f4-48da-9818-ea3f9e4f6227" />

## Widgets

Add the widgets you want, edit them in place, and drag to rearrange them:

- **Clock**: the current time in any time zone, in your system's 12- or 24-hour format.
- **Countdown**: the time left until a date, written in plain language (for example, "5 days, 3 hours from now"). Give one a start date and it fills a progress bar instead. They can repeat hourly, daily, weekly, monthly, or yearly.
- **Timer**: counts down from a duration you set, with an optional chime when it reaches zero.
- **Stopwatch**: counts up, with start, pause, and reset.
- **Note**: a short sticky note.
- **Todo**: four tasks you type onto the card and check off as you go.
- **Habit**: mark any day of the current week done and see it at a glance.
- **Quote**: cycles through a list of quotes you provide, either once a day or on every new tab.

## Install

### From the Chrome Web Store

1. Open the [Dayboard listing](https://chromewebstore.google.com/detail/gldaglgodbdhnpjjnoocfnclmdejpaii).
2. Click **Add to Chrome** (or **Add to Edge**), then confirm.
3. Open a new tab.

This works on Chrome, Microsoft Edge, and other Chromium browsers such as Brave, Opera, and Vivaldi. On Edge, you install from the Chrome Web Store; Edge asks you to **Allow extensions from other stores** the first time.

### From source

For development, or to run a build before it reaches the store:

```sh
git clone https://github.com/danielchalmers/Dayboard.git
cd Dayboard
npm install
npm run build        # Chrome, output in .output/chrome-mv3
npm run build:edge   # Edge, output in .output/edge-mv3
```

Then load the unpacked build:

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select `.output/chrome-mv3` (or `.output/edge-mv3`).

## Privacy

- Dayboard requests only the `storage` permission.
- No accounts, analytics, ads, tracking, or remote code, and no network requests.

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for details.

## Development

Dayboard is built with [WXT](https://wxt.dev), [React](https://react.dev), and [TypeScript](https://www.typescriptlang.org) as a Manifest V3 extension.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Chrome development server |
| `npm run dev:edge` | Start the Edge development server |
| `npm run build` | Build for Chrome (`.output/chrome-mv3`) |
| `npm run build:edge` | Build for Edge (`.output/edge-mv3`) |
| `npm test` | Run unit tests ([Vitest](https://vitest.dev)) |
| `npm run e2e` | Run end-to-end tests ([Playwright](https://playwright.dev)) |
| `npm run verify` | Typecheck, test, and build |
