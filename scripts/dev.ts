import { readdirSync, readFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"

import { build, type Plugin } from "vite"

import { openDevBrowser, reloadExtension, reloadPages, type DevBrowser } from "./dev-browser.ts"

// `npm run dev` (or `npm run dev:edge`): build the extension in watch mode, open the browser with it loaded, and reload it after every rebuild. Teichos's dev script works the same way.
// It builds into a folder of its own, so a production build (and e2e, which makes one) never swaps files out from under the open browser.
const browser = process.argv[2] === "edge" ? "edge" : "chrome"
const browserName = browser === "edge" ? "Edge" : "Chrome"
const outDir = resolve(`.output/${browser}-mv3-dev`)

// Vite copies public/ into every build but doesn't watch it, so an edit there (the service worker, an icon) would otherwise wait for a restart.
const watchPublicDir = (): Plugin => {
  let publicDir = ""
  return {
    name: "dayboard:watch-public-dir",
    configResolved(config) {
      publicDir = config.publicDir
    },
    buildStart() {
      for (const entry of readdirSync(publicDir, { recursive: true, withFileTypes: true })) {
        if (entry.isFile()) {
          this.addWatchFile(join(entry.parentPath, entry.name))
        }
      }
    }
  }
}

const watcher = await build({
  mode: "development",
  build: { outDir, watch: {}, minify: false, sourcemap: true },
  plugins: [watchPublicDir()]
})

if (!("on" in watcher)) {
  throw new Error("Vite built once instead of watching.")
}

let devBrowser: DevBrowser | undefined
let opened = false
let failed = false
let loadedWorker = ""
// Rebuilds can finish back to back, so each reload waits for the one before it.
let reloading = Promise.resolve()

// The manifest and the service worker it names.
// Built chunk names carry a hash of their contents, so a change anywhere in the worker's code changes the worker file, while a change only the pages use leaves it byte for byte the same.
const readWorker = () => {
  const manifest = readFileSync(join(outDir, "manifest.json"), "utf8")
  const { background } = JSON.parse(manifest) as chrome.runtime.ManifestV3
  const worker = background ? readFileSync(join(outDir, background.service_worker), "utf8") : ""
  return `${manifest}\n${worker}`
}

const open = async () => {
  try {
    devBrowser = await openDevBrowser(outDir, browser)
    console.log(`Opened ${browserName}`)
    // Closing the browser ends the dev session, as stopping the script closes the browser.
    devBrowser.context.on("close", () => void watcher.close())
  } catch (error) {
    // Keep rebuilding when the browser can't start (say, it isn't installed), so the folder can still be loaded by hand.
    console.warn(error instanceof Error ? error.message : error)
    console.info(`Load "${relative(process.cwd(), outDir)}" as an unpacked extension manually.`)
  }
}

const reload = async (current: DevBrowser, workerChanged: boolean) => {
  try {
    if (workerChanged) {
      const tabs = await reloadExtension(current)
      console.log(`Reloaded the extension${tabs > 0 ? ` and reopened ${tabs} tab(s)` : ""}`)
    } else {
      const pages = await reloadPages(current)
      console.log(`Reloaded ${pages} page(s)`)
    }
  } catch (error) {
    console.warn("Could not reload:", error instanceof Error ? error.message : error)
  }
}

watcher.on("event", (event) => {
  if (event.code === "START") {
    failed = false
  }
  if (event.code === "ERROR") {
    // Vite prints the error. The pages keep the last build that worked until the next one does.
    failed = true
  }
  if (event.code !== "END" || failed) {
    return
  }

  const worker = readWorker()
  const workerChanged = worker !== loadedWorker
  loadedWorker = worker

  if (!opened) {
    opened = true
    void open()
    return
  }

  const current = devBrowser
  if (current) {
    reloading = reloading.then(() => reload(current, workerChanged))
  }
})
