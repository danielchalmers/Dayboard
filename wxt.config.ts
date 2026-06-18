import { defineConfig } from "wxt"

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Clockboard",
    short_name: "Clockboard",
    version: process.env.RELEASE_VERSION ?? "0.0.0",
    description: "Live digital clocks and countdowns for your new tab page.",
    minimum_chrome_version: "116",
    permissions: ["storage"],
    icons: {
      16: "icon16.png",
      32: "icon32.png",
      48: "icon48.png",
      128: "icon128.png"
    }
  },
  webExt: {
    // Allow --load-extension on newer Chrome builds during `wxt` dev mode.
    chromiumArgs: ["--disable-features=DisableLoadExtensionCommandLineSwitch"]
  }
})
