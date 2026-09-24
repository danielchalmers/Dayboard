import type { Locator, Request } from "@playwright/test"

import { expect, test } from "./fixtures"
import { addWidget, boxOf, cardByTitle, openNewTab } from "./helpers"

// The standing rules of the product, the ones a well-meaning change breaks quietly: a minimal manifest, no network, a board that scrolls from the top, centered dialogs, buttons that stay put, and menus that close.
// Each of these is one line of config or CSS away from regressing with every feature test still green.

test("ships a minimal, new-tab-only manifest", async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/newtab.html`)

  // `chrome.runtime.getManifest()` is typed as a ManifestV2 | ManifestV3 union, so serialize it inside the page and assert against a plain record rather than narrowing a union that says nothing about what shipped.
  const manifest = await page.evaluate(
    () =>
      JSON.parse(JSON.stringify(chrome.runtime.getManifest())) as Record<
        string,
        unknown
      >
  )

  // Storage is the whole ask. Anything else here is a new store-review conversation.
  expect(manifest.permissions).toEqual(["storage"])
  expect(manifest.host_permissions).toBeUndefined()

  expect(manifest).toMatchObject({
    chrome_url_overrides: { newtab: "newtab.html" },
    // The browser's Options link opens the board with the overlay shown, which is why there is no options entrypoint of its own.
    options_ui: { page: "newtab.html?view=settings", open_in_tab: true },
    // MV3 registers a service worker even though this one only exists to satisfy that.
    background: { service_worker: "background.js" }
  })

  expect(manifest.options_page).toBeUndefined()
  // Asserting `action` is absent outright is stricter than the written rule, which forbids a popup rather than a toolbar icon. That is deliberate: Dayboard lives on the new tab page and has nothing to put behind a toolbar button.
  expect(manifest.action).toBeUndefined()
})

test("never reaches the network", async ({ page, context, extensionId }) => {
  // `data:` covers the inline tick icon in the stylesheet and `blob:` the object URL that JSON export downloads through.
  const offline = ["chrome-extension://", "data:", "blob:", "about:"]
  const external: string[] = []

  // Listening on the context rather than the page covers the service worker too, where a telemetry ping is at least as likely to live, and survives the reload inside `openNewTab`.
  const collect = (request: Request) => {
    const url = request.url()

    if (!offline.some((prefix) => url.startsWith(prefix))) {
      external.push(url)
    }
  }

  context.on("request", collect)

  try {
    await openNewTab(page, extensionId)
    await addWidget(page, "quote", "Mantras")
    await page.getByRole("button", { name: "Options" }).click()
    await expect(page.getByRole("dialog", { name: "Options" })).toBeVisible()

    // Dayboard is offline by design: no analytics, no web font, no quotes API.
    // The scope is what this test drove, not the whole bundle, so a request behind an untouched code path would still slip past.
    expect(external).toEqual([])
  } finally {
    // The context outlives the test, so hand back the listener instead of leaving it collecting for the rest of the worker.
    context.off("request", collect)
  }
})

test("scrolls from the top once the board outgrows the screen", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  // Short enough that the default board overflows and the centering margins collapse.
  await page.setViewportSize({ width: 1000, height: 400 })
  const viewport = page.viewportSize()

  if (!viewport) {
    throw new Error("Unable to determine the viewport size")
  }

  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollHeight >
      document.documentElement.clientHeight
  )
  expect(overflows).toBe(true)

  // Centering a flex child with auto margins is the classic way to strand the top of tall content above the scroll origin, where nothing can bring it back.
  await page.evaluate(() => window.scrollTo(0, 0))
  const header = await boxOf(
    page.locator(".page-header"),
    "the page header once the board scrolls"
  )
  expect(header.y).toBeGreaterThanOrEqual(0)

  // The far end is reachable too, so the board is a normal top-scrolling document at this height.
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight)
  )
  const last = await boxOf(
    page.locator(".board-row").last(),
    "the last card at the bottom of the scroll"
  )
  expect(last.y + last.height).toBeLessThanOrEqual(viewport.height)
})

test("opens dialogs centered in the viewport", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openNewTab(page, extensionId)

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }))

  const expectCentered = async (dialog: Locator, what: string) => {
    await expect(dialog).toBeVisible()

    // The dialog scales up and rises 16px as it enters, so a box read the moment it appears still sits low.
    await dialog.evaluate((el) =>
      Promise.all(el.getAnimations().map((animation) => animation.finished))
    )

    const box = await boxOf(dialog, what)

    // The backdrop is fixed to the layout viewport, which the permanently reserved scrollbar gutter leaves a scrollbar narrower than the window, so a perfectly centered dialog still sits about half a scrollbar left of the window's own center.
    // Hence the wider allowance across, and a tight one down, where nothing is reserved. Both are far tighter than a dialog anchored to a corner, docked as a sheet, or aligned to the top.
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(16)
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(4)
  }

  await page.getByRole("button", { name: "Options" }).click()
  await expectCentered(
    page.getByRole("dialog", { name: "Options" }),
    "the Options dialog"
  )

  // Escape rather than Done, so the overlay closes without spending a write on settings that did not change.
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add clock" }).click()
  await expectCentered(
    page.getByRole("dialog", { name: "Add clock" }),
    "the Add clock dialog"
  )
})

test("keeps buttons pointer-cursored and still under the pointer", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const expectSteadyPointer = async (control: Locator, what: string) => {
    expect(
      await control.evaluate((element) => getComputedStyle(element).cursor)
    ).toBe("pointer")

    // `boundingBox` is viewport-relative and `hover` scrolls, so settle the scroll position first or the two boxes differ for a reason that has nothing to do with hover.
    await control.scrollIntoViewIfNeeded()
    const before = await boxOf(control, what)
    await control.hover()
    const after = await boxOf(control, what)

    expect(after.width).toBe(before.width)
    expect(after.height).toBe(before.height)
    // The board is a centered responsive grid, so fractional positions are normal and only a real shift should fail.
    expect(after.x).toBeCloseTo(before.x, 1)
    expect(after.y).toBeCloseTo(before.y, 1)
  }

  // A named walk rather than a sweep over every button: `button:disabled` is deliberately `not-allowed`, and `.color-swatch` deliberately scales on hover, so a blanket assertion would be asserting the opposite of the design.
  await expectSteadyPointer(
    page.getByRole("button", { name: "Options" }),
    "the Options button"
  )
  // Add widget is a <summary role="button">, not a <button>, so the element-level `cursor: pointer` never reaches it and only the `.icon-button` declaration keeps it from showing a text caret.
  const addWidgetButton = page.getByRole("button", { name: "Add widget" })
  await expectSteadyPointer(addWidgetButton, "the Add widget button")

  await addWidgetButton.click()
  // The entry animation belongs to the panel, not to the item inside it, so waiting on the item would measure a menu still scaling up.
  await page
    .locator(".add-menu__panel")
    .evaluate((panel) =>
      Promise.all(panel.getAnimations().map((animation) => animation.finished))
    )
  // An item near the top of the panel, which is scrollable and can put a lower one out of reach on a short viewport.
  await expectSteadyPointer(
    page.getByRole("button", { name: "Add clock" }),
    "an add menu item"
  )
  await page.keyboard.press("Escape")

  await addWidget(page, "stopwatch", "Focus")
  // Hover the stopwatch while it is stopped, so ticking digits cannot reflow the card between the two measurements.
  await expectSteadyPointer(
    cardByTitle(page, "Focus").getByRole("button", { name: "Start" }),
    "a stopwatch button"
  )

  await page.getByRole("button", { name: "Options" }).click()
  await expectSteadyPointer(
    page.getByRole("button", { name: "Done" }),
    "the Options dialog's Done button"
  )
})

test("closes the add menu once a kind is chosen", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await expect(page.getByRole("button", { name: "Add countdown" })).toBeVisible()

  await page.getByRole("button", { name: "Add clock" }).click()

  // Choosing a kind closes the panel itself, so it is not left open behind the dialog and does not reappear when the dialog goes away.
  // The assertion names a sibling kind because "Add clock" is the open dialog's accessible name too.
  await expect(
    page.getByRole("button", { name: "Add countdown" })
  ).not.toBeVisible()
  await expect(page.getByRole("dialog", { name: "Add clock" })).toBeVisible()
})
