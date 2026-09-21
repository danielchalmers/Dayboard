// Idle resource diagnostics for the new tab page.
//
// Loads the built extension (.output/chrome-mv3) into a persistent Chromium, seeds a board scenario, lets it settle,
// then watches an idle window and reports where the page spends its time while nobody touches it:
//   - a CDP trace of the page's renderer (timer fires, script, style, layout, paint, compositor frames)
//   - CDP Performance metrics (task/script/layout/style durations, layout and style counts, heap)
//   - OS-level CPU time of every process in this Chromium tree (renderers, GPU, browser), sampled with PowerShell
//   - in-page counters: timer/rAF callbacks and DOM mutations under #root
//
// Usage: node scripts/idle-perf.mjs [--seconds=20] [--scenario=default,still,stopwatch,hidden] [--json=out.json]
// Build first: npm run build

import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "@playwright/test"

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=")
    return [key, value]
  })
)
const WINDOW_SECONDS = Number(args.seconds ?? 20)
const SCENARIOS = (args.scenario ?? "default,still,stopwatch,hidden").split(",")
const HEADLESS = args.headless === "true"

const extensionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.output/chrome-mv3"
)

const widget = (kind, title, settings) => ({
  id: `${kind}-${Math.random().toString(36).slice(2, 8)}`,
  kind,
  title,
  color: "sky",
  settings
})

const inAnHour = () => new Date(Date.now() + 3_600_000).toISOString()

// Boards under test. `default` mirrors the first-run board's kinds; `still` has nothing time-sensitive; `stopwatch` needs real per-second updates.
const boards = {
  default: () => [
    widget("clock", "Local time", { timeZone: "" }),
    widget("countdown", "Tomorrow morning", {
      targetAt: inAnHour(),
      startAt: new Date().toISOString()
    }),
    widget("note", "Welcome", { text: "hello" }),
    widget("quote", "Reminder", { quotes: ["a", "b", "c"] }),
    widget("habit", "Daily walk", { history: [] }),
    widget("countdown", "This year", { targetAt: inAnHour() })
  ],
  still: () => [
    widget("note", "Welcome", { text: "hello" }),
    widget("todo", "Tasks", { items: [] })
  ],
  stopwatch: () => [
    ...boards.default(),
    widget("stopwatch", "Running", {
      running: true,
      elapsedMs: 0,
      startedAt: Date.now()
    })
  ]
}
boards.hidden = boards.default

const powershell = (script) =>
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  })

// Every process under the browser we launched, with cumulative CPU time. Chromium's helpers are all children of the browser process.
const sampleProcessTree = (browserPid) => {
  const rows = JSON.parse(
    powershell(
      `Get-CimInstance Win32_Process -Filter "Name='chrome.exe' or Name='chromium.exe' or Name='msedge.exe'" | Select-Object ProcessId,ParentProcessId,KernelModeTime,UserModeTime,WorkingSetSize,CommandLine | ConvertTo-Json -Compress`
    ) || "[]"
  )
  const list = Array.isArray(rows) ? rows : [rows]
  const byPid = new Map(list.map((row) => [row.ProcessId, row]))
  const mine = []
  const walk = (pid) => {
    const row = byPid.get(pid)
    if (!row) return
    mine.push(row)
    for (const child of list) if (child.ParentProcessId === pid) walk(child.ProcessId)
  }
  walk(browserPid)
  return mine.map((row) => ({
    pid: row.ProcessId,
    type: /--type=(\S+)/.exec(row.CommandLine ?? "")?.[1] ?? "browser",
    extension: /--extension-process/.test(row.CommandLine ?? ""),
    cpuMs: (Number(row.KernelModeTime) + Number(row.UserModeTime)) / 10_000,
    workingSetMb: Number(row.WorkingSetSize) / 1_048_576
  }))
}

const diffProcessTrees = (before, after) =>
  after
    .map((row) => {
      const prev = before.find((candidate) => candidate.pid === row.pid)
      return { ...row, cpuMsDelta: prev ? row.cpuMs - prev.cpuMs : row.cpuMs }
    })
    .sort((a, b) => b.cpuMsDelta - a.cpuMsDelta)

const INSTRUMENT = `
  (() => {
    const counts = { setInterval: 0, setTimeout: 0, requestAnimationFrame: 0, mutations: 0, intervalsCreated: 0, timeoutsCreated: 0 }
    window.__idleCounts = counts
    const origInterval = window.setInterval.bind(window)
    const origTimeout = window.setTimeout.bind(window)
    const origRaf = window.requestAnimationFrame.bind(window)
    window.setInterval = (fn, ms, ...rest) => {
      counts.intervalsCreated += 1
      return origInterval(typeof fn === "function" ? (...a) => { counts.setInterval += 1; return fn(...a) } : fn, ms, ...rest)
    }
    window.setTimeout = (fn, ms, ...rest) => {
      counts.timeoutsCreated += 1
      return origTimeout(typeof fn === "function" ? (...a) => { counts.setTimeout += 1; return fn(...a) } : fn, ms, ...rest)
    }
    window.requestAnimationFrame = (fn) => origRaf((t) => { counts.requestAnimationFrame += 1; return fn(t) })
    document.addEventListener("DOMContentLoaded", () => {
      const root = document.getElementById("root")
      if (!root) return
      new MutationObserver((records) => { counts.mutations += records.length })
        .observe(root, { subtree: true, childList: true, attributes: true, characterData: true })
    })
  })()
`

const readCounts = (page) => page.evaluate(() => ({ ...window.__idleCounts }))

const METRIC_KEYS = [
  "TaskDuration",
  "ScriptDuration",
  "LayoutDuration",
  "RecalcStyleDuration",
  "LayoutCount",
  "RecalcStyleCount",
  "JSHeapUsedSize",
  "Nodes",
  "JSEventListeners"
]
const metricsToObject = ({ metrics }) =>
  Object.fromEntries(metrics.filter((m) => METRIC_KEYS.includes(m.name)).map((m) => [m.name, m.value]))

// Summarise a trace: per event name, how many and how long, restricted to the pid of the page under test.
const summariseTrace = (events, pagePid) => {
  const totals = new Map()
  for (const event of events) {
    if (pagePid && event.pid !== pagePid) continue
    if (event.ph !== "X" && event.ph !== "I" && event.ph !== "B") continue
    const bucket = totals.get(event.name) ?? { count: 0, ms: 0 }
    bucket.count += 1
    bucket.ms += (event.dur ?? 0) / 1000
    totals.set(event.name, bucket)
  }
  return [...totals.entries()]
    .map(([name, { count, ms }]) => ({ name, count, ms: Number(ms.toFixed(1)) }))
    .sort((a, b) => b.ms - a.ms || b.count - a.count)
}

const collectTrace = async (client, seconds) => {
  const events = []
  client.on("Tracing.dataCollected", ({ value }) => events.push(...value))
  const complete = new Promise((resolve) => client.once("Tracing.tracingComplete", resolve))
  await client.send("Tracing.start", {
    transferMode: "ReportEvents",
    traceConfig: {
      recordMode: "recordContinuously",
      includedCategories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "disabled-by-default-devtools.timeline.frame",
        "v8.execute",
        "blink.user_timing"
      ]
    }
  })
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
  await client.send("Tracing.end")
  await complete
  return events
}

const runScenario = async (name) => {
  const userDataDir = mkdtempSync(path.join(tmpdir(), "dayboard-idle-"))
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: HEADLESS,
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1400, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })
  try {
    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) serviceWorker = await context.waitForEvent("serviceworker", { timeout: 10_000 })
    const extensionId = serviceWorker.url().split("/")[2]
    const url = `chrome-extension://${extensionId}/newtab.html`

    // Seed the board from a throwaway page, then open the page we measure fresh so its render is a real cold open of that board.
    const seeder = await context.newPage()
    await seeder.goto(url)
    await seeder.evaluate(
      async (state) => {
        await chrome.storage.sync.set({ "dayboard-state": state })
      },
      { widgets: boards[name](), settings: { name: "" } }
    )
    await seeder.close()

    const page = await context.newPage()
    await page.addInitScript(INSTRUMENT)
    await page.goto(url)
    await page.getByRole("heading", { level: 1 }).waitFor()

    if (name === "hidden") {
      // Playwright gives each page of a persistent context its own window, so another tab cannot hide this one; stand in for the tab being switched away from by reporting `hidden` the way the browser would.
      // This exercises the page's own response to being hidden (its visibilitychange handling), not Chromium's background-tab timer throttling.
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
        Object.defineProperty(document, "hidden", { configurable: true, value: true })
        document.dispatchEvent(new Event("visibilitychange"))
      })
    } else {
      await page.bringToFront()
    }

    // Let the open settle (fonts, entrance, storage watch) before the idle window starts.
    await new Promise((resolve) => setTimeout(resolve, 4_000))

    const client = await context.newCDPSession(page)
    await client.send("Performance.enable")

    const browserPid = findBrowserPid(userDataDir)
    const visibility = await page.evaluate(() => document.visibilityState)
    const countsBefore = await readCounts(page)
    const metricsBefore = metricsToObject(await client.send("Performance.getMetrics"))
    const treeBefore = sampleProcessTree(browserPid)

    const events = await collectTrace(client, WINDOW_SECONDS)

    const treeAfter = sampleProcessTree(browserPid)
    const metricsAfter = metricsToObject(await client.send("Performance.getMetrics"))
    const countsAfter = await readCounts(page)

    // The page's renderer is the pid whose trace carries our RunTask events with a chrome-extension frame; take the pid with the most timer fires that also has the extension's origin among its frames.
    const rendererPid = pickRendererPid(events, extensionId)
    const metrics = Object.fromEntries(
      METRIC_KEYS.map((key) => [
        key,
        key.endsWith("Duration") ? Number(((metricsAfter[key] - metricsBefore[key]) * 1000).toFixed(1)) : key === "JSHeapUsedSize" ? Number(((metricsAfter[key] - metricsBefore[key]) / 1024).toFixed(0)) : metricsAfter[key] - metricsBefore[key]
      ])
    )
    const counts = Object.fromEntries(
      Object.keys(countsAfter).map((key) => [key, countsAfter[key] - countsBefore[key]])
    )
    const processes = diffProcessTrees(treeBefore, treeAfter)

    return {
      scenario: name,
      seconds: WINDOW_SECONDS,
      visibility,
      rendererPid,
      metrics,
      counts,
      trace: summariseTrace(events, rendererPid),
      processes
    }
  } finally {
    await context.close()
  }
}

const findBrowserPid = (userDataDir) => {
  const rows = JSON.parse(
    powershell(
      `Get-CimInstance Win32_Process -Filter "Name='chrome.exe' or Name='chromium.exe'" | Where-Object { $_.CommandLine -like '*${userDataDir}*' -and $_.CommandLine -notlike '*--type=*' } | Select-Object ProcessId | ConvertTo-Json -Compress`
    ) || "null"
  )
  return Array.isArray(rows) ? rows[0]?.ProcessId : rows?.ProcessId
}

const pickRendererPid = (events, extensionId) => {
  const pidsWithOrigin = new Set()
  for (const event of events) {
    const data = event.args?.data
    if (typeof data?.url === "string" && data.url.includes(extensionId)) pidsWithOrigin.add(event.pid)
    if (typeof data?.frames === "object") {
      for (const frame of data.frames ?? []) if (String(frame.url ?? "").includes(extensionId)) pidsWithOrigin.add(frame.processId)
    }
  }
  const timerFires = new Map()
  for (const event of events) {
    if (event.name === "TimerFire" && pidsWithOrigin.has(event.pid)) timerFires.set(event.pid, (timerFires.get(event.pid) ?? 0) + 1)
  }
  return [...timerFires.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? [...pidsWithOrigin][0]
}

const pad = (value, width) => String(value).padStart(width)

const report = (result) => {
  const s = result.seconds
  console.log(`\n=== ${result.scenario} (${s}s idle, tab ${result.visibility}, renderer pid ${result.rendererPid ?? "?"}) ===`)
  console.log("Renderer (CDP Performance deltas):")
  const m = result.metrics
  console.log(
    `  task ${m.TaskDuration}ms  script ${m.ScriptDuration}ms  style ${m.RecalcStyleDuration}ms (${m.RecalcStyleCount}x)  layout ${m.LayoutDuration}ms (${m.LayoutCount}x)  heap ${m.JSHeapUsedSize >= 0 ? "+" : ""}${m.JSHeapUsedSize}KB  nodes ${m.Nodes >= 0 ? "+" : ""}${m.Nodes}`
  )
  console.log(
    `  => main-thread busy ${((m.TaskDuration / (s * 1000)) * 100).toFixed(2)}% of wall time`
  )
  const c = result.counts
  console.log(
    `In-page: setInterval fires ${c.setInterval}, setTimeout fires ${c.setTimeout}, rAF ${c.requestAnimationFrame}, DOM mutations ${c.mutations}, intervals created ${c.intervalsCreated}`
  )
  console.log("Trace, top events in the page renderer:")
  for (const row of result.trace.slice(0, 14)) {
    console.log(`  ${pad(row.count, 6)}x ${pad(row.ms, 8)}ms  ${row.name}`)
  }
  console.log("OS CPU time over the window, per Chromium process:")
  for (const p of result.processes.filter((row) => row.cpuMsDelta > 0 || row.extension).slice(0, 8)) {
    console.log(
      `  pid ${pad(p.pid, 6)}  ${pad(p.type, 9)}${p.extension ? " (ext)" : "      "}  +${pad(p.cpuMsDelta.toFixed(0), 5)}ms CPU (${((p.cpuMsDelta / (s * 1000)) * 100).toFixed(2)}% of one core)  RSS ${p.workingSetMb.toFixed(0)}MB`
    )
  }
}

const results = []
for (const scenario of SCENARIOS) {
  const result = await runScenario(scenario)
  results.push(result)
  report(result)
}
if (args.json) {
  writeFileSync(args.json, JSON.stringify(results, null, 2))
  console.log(`\nWrote ${args.json}`)
}
