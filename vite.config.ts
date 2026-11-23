import { fileURLToPath } from "node:url"

import { defineConfig, type Plugin } from "vite"

// Chrome and Edge read the same manifest, so one build serves both.
const manifest = {
  manifest_version: 3,
  name: "Dayboard",
  short_name: "Dayboard",
  // The release workflow stamps the tag's version here; the checked-in package.json stays at 0.0.0.
  version: process.env.RELEASE_VERSION ?? "0.0.0",
  description: "A calm new tab board of clocks, countdowns, notes, timers, quotes, and habits.",
  minimum_chrome_version: "116",
  permissions: ["storage"],
  icons: {
    16: "icon16.png",
    32: "icon32.png",
    48: "icon48.png",
    128: "icon128.png"
  },
  chrome_url_overrides: {
    newtab: "newtab.html"
  },
  // The new tab page doubles as the options page so the browser's "Options" link (right-click the extension / Manage extensions) opens the board with the options overlay shown.
  // Reusing newtab.html keeps the extension new-tab-only with no separate options entrypoint.
  options_ui: {
    page: "newtab.html?view=settings",
    open_in_tab: true
  },
  // A static file in public/, copied as-is.
  background: {
    service_worker: "background.js"
  }
} satisfies chrome.runtime.ManifestV3

const writeManifest = (): Plugin => ({
  name: "dayboard-manifest",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "manifest.json",
      source: JSON.stringify(manifest, null, 2)
    })
  }
})

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  build: {
    outDir: ".output/chrome-mv3",
    rolldownOptions: {
      input: "newtab.html"
    },
    // The page loads as a single module with nothing split off to preload, so the polyfill would only be dead weight.
    modulePreload: { polyfill: false }
  },
  plugins: [writeManifest()]
})
