import type { Page, TestInfo } from "@playwright/test"

import { expect, test } from "./fixtures"
import type { ClockboardState } from "../src/lib/types"

const STORAGE_KEY = "clockboard-state"
const STORY_NOW = "2025-05-09T15:24:00.000Z"

const storyState: ClockboardState = {
  widgets: [
    {
      id: "austin",
      kind: "clock",
      title: "Austin",
      colorPreset: "slate",
      settings: { timeZone: "America/Chicago" }
    },
    {
      id: "new-york",
      kind: "clock",
      title: "New York",
      colorPreset: "slate",
      settings: { timeZone: "America/New_York" }
    },
    {
      id: "london",
      kind: "clock",
      title: "London",
      colorPreset: "slate",
      settings: { timeZone: "Europe/London" }
    },
    {
      id: "tokyo",
      kind: "clock",
      title: "Tokyo",
      colorPreset: "slate",
      settings: { timeZone: "Asia/Tokyo" }
    },
    {
      id: "weekend-getaway",
      kind: "countdown",
      title: "Weekend getaway",
      colorPreset: "slate",
      settings: { targetAt: "2025-05-17T13:00:00.000Z" }
    },
    {
      id: "summer-vacation",
      kind: "countdown",
      title: "Summer vacation",
      colorPreset: "slate",
      settings: { targetAt: "2025-06-28T13:00:00.000Z" }
    },
    {
      id: "emma-birthday",
      kind: "countdown",
      title: "Emma's birthday",
      colorPreset: "slate",
      settings: { targetAt: "2025-07-14T05:00:00.000Z" }
    },
    {
      id: "christmas",
      kind: "countdown",
      title: "Christmas",
      colorPreset: "slate",
      settings: { targetAt: "2025-12-25T06:00:00.000Z" }
    }
  ],
  settings: { dragToMove: true, columns: "auto", name: "", chimeOnTimerEnd: false }
}

const freezeTime = async (page: Page) => {
  await page.addInitScript((isoNow) => {
    const fixedNow = new Date(isoNow).getTime()
    const NativeDate = Date

    const FixedDate = function (
      this: Date,
      ...args: unknown[]
    ): Date | string {
      if (!(this instanceof FixedDate)) {
        return new NativeDate(fixedNow).toString()
      }

      return args.length === 0
        ? new NativeDate(fixedNow)
        : (Reflect.construct(NativeDate, args) as Date)
    } as unknown as DateConstructor

    FixedDate.now = () => fixedNow
    FixedDate.parse = NativeDate.parse
    FixedDate.UTC = NativeDate.UTC
    ;(FixedDate as DateConstructor & { prototype: Date }).prototype =
      NativeDate.prototype

    window.Date = FixedDate
  }, STORY_NOW)
}

const openStoryBoard = async (page: Page, extensionId: string) => {
  await freezeTime(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`chrome-extension://${extensionId}/newtab.html`)
  await page.evaluate(
    ({ key, state }) => chrome.storage.sync.set({ [key]: state }),
    { key: STORAGE_KEY, state: storyState }
  )
  await page.reload()
  await expect(page.getByRole("heading", { name: "Clockboard" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Austin" })).toBeVisible()
}

const attachScreenshot = async (
  testInfo: TestInfo,
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {}
) => {
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({
    animations: "disabled",
    fullPage: options.fullPage ?? false,
    path
  })

  await testInfo.attach(name, {
    contentType: "image/png",
    path
  })
}

const openWidgetMenu = async (page: Page, title: string) => {
  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: title }) })

  await card.click({ button: "right" })
}

test("captures Clockboard product screenshots", async ({
  page,
  extensionId
}, testInfo) => {
  await openStoryBoard(page, extensionId)

  await attachScreenshot(testInfo, page, "clockboard-main-desktop")

  await openWidgetMenu(page, "New York")
  await expect(page.getByRole("menuitem", { name: "Edit New York" })).toBeVisible()
  await attachScreenshot(testInfo, page, "clockboard-widget-menu-desktop")
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("menuitem", { name: "Edit New York" })
  ).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await attachScreenshot(testInfo, page, "clockboard-main-mobile", {
    fullPage: true
  })

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add clock" }).click()
  await expect(page.getByRole("dialog", { name: "Add clock" })).toBeVisible()
  await page.getByLabel("Name").fill("Paris")
  await page.getByLabel("Time zone").fill("Europe/Paris")
  await attachScreenshot(testInfo, page, "clockboard-add-clock-dialog")
  await page.getByRole("button", { name: "Cancel" }).click()

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add countdown" }).click()
  await expect(page.getByRole("dialog", { name: "Add countdown" })).toBeVisible()
  await page.getByLabel("Name").fill("Product launch")
  await page.getByLabel("When").fill("2025-06-12T09:00")
  await attachScreenshot(testInfo, page, "clockboard-add-countdown-dialog")
  await page.getByRole("button", { name: "Cancel" }).click()

  await openWidgetMenu(page, "New York")
  await page.getByRole("menuitem", { name: "Edit New York" }).click()
  await expect(page.getByRole("dialog", { name: "Edit clock" })).toBeVisible()
  await attachScreenshot(testInfo, page, "clockboard-edit-clock-dialog")
  await page.getByRole("button", { name: "Cancel" }).click()

  await openWidgetMenu(page, "Summer vacation")
  await page.getByRole("menuitem", { name: "Edit Summer vacation" }).click()
  await expect(
    page.getByRole("dialog", { name: "Edit countdown" })
  ).toBeVisible()
  await attachScreenshot(testInfo, page, "clockboard-edit-countdown-dialog")
})
