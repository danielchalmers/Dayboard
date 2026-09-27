import type { Page, TestInfo } from "@playwright/test"

import { expect, test } from "./fixtures"
import { openWidgetMenu } from "./helpers"
import type { DayboardState } from "../src/lib/types"

const STORAGE_KEY = "dayboard-state"
const STORY_NOW = "2025-05-09T15:24:00.000Z"

const storyState: DayboardState = {
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
      // A start turns this one into a progress bar, so the story shows both countdown presentations side by side.
      settings: {
        targetAt: "2025-06-28T13:00:00.000Z",
        startAt: "2025-04-01T13:00:00.000Z"
      }
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
    },
    {
      id: "morning-walk",
      kind: "habit",
      title: "Morning walk",
      colorPreset: "slate",
      // A partly filled week around the story's Friday: some days done, today still open, the weekend ahead.
      settings: { history: ["2025-05-05", "2025-05-06", "2025-05-08"] }
    }
  ],
  settings: { name: "" }
}

const openStoryBoard = async (page: Page, extensionId: string) => {
  // Every capture in the story has to read the same instant, or the four clock cards tick between the desktop shot and the dialogs later in the test.
  await page.clock.setFixedTime(STORY_NOW)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`chrome-extension://${extensionId}/newtab.html`)
  await page.evaluate(
    ({ key, state }) => chrome.storage.sync.set({ [key]: state }),
    { key: STORAGE_KEY, state: storyState }
  )
  await page.reload()
  // The browser is pinned to UTC, so STORY_NOW is a Friday afternoon on every machine and the greeting is a fixed string rather than a pattern.
  await expect(
    page.getByRole("heading", { name: "Good afternoon" })
  ).toBeVisible()
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

test("captures Dayboard product screenshots", async ({
  page,
  extensionId
}, testInfo) => {
  await openStoryBoard(page, extensionId)

  await attachScreenshot(testInfo, page, "dayboard-main-desktop")

  await openWidgetMenu(page, "New York")
  await expect(page.getByRole("menuitem", { name: "Edit New York" })).toBeVisible()
  await attachScreenshot(testInfo, page, "dayboard-widget-menu-desktop")
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("menuitem", { name: "Edit New York" })
  ).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  // Scroll through the page once before the stitched full-page capture: straight after a viewport resize Chromium can leave off-screen tiles unpainted, which showed up as a blank band across the middle cards.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.evaluate(() => window.scrollTo(0, 0))
  await attachScreenshot(testInfo, page, "dayboard-main-mobile", {
    fullPage: true
  })

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add clock" }).click()
  await expect(page.getByRole("dialog", { name: "Add clock" })).toBeVisible()
  await page.getByLabel("Name").fill("Paris")
  await page.getByLabel("Time zone").fill("Europe/Paris")
  await attachScreenshot(testInfo, page, "dayboard-add-clock-dialog")
  await page.getByRole("button", { name: "Cancel" }).click()

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add countdown" }).click()
  await expect(page.getByRole("dialog", { name: "Add countdown" })).toBeVisible()
  await page.getByLabel("Name").fill("Product launch")
  await page.getByLabel("When").fill("2025-06-12T09:00")
  await attachScreenshot(testInfo, page, "dayboard-add-countdown-dialog")
  await page.getByRole("button", { name: "Cancel" }).click()

  await openWidgetMenu(page, "New York")
  await page.getByRole("menuitem", { name: "Edit New York" }).click()
  await expect(page.getByRole("dialog", { name: "Edit clock" })).toBeVisible()
  await attachScreenshot(testInfo, page, "dayboard-edit-clock-dialog")
  await page.getByRole("button", { name: "Cancel" }).click()

  await openWidgetMenu(page, "Summer vacation")
  await page.getByRole("menuitem", { name: "Edit Summer vacation" }).click()
  await expect(
    page.getByRole("dialog", { name: "Edit countdown" })
  ).toBeVisible()
  await attachScreenshot(testInfo, page, "dayboard-edit-countdown-dialog")
  await page.getByRole("button", { name: "Cancel" }).click()

  await page.getByRole("button", { name: "Options" }).click()
  await expect(page.getByRole("dialog", { name: "Options" })).toBeVisible()
  await attachScreenshot(testInfo, page, "dayboard-options-dialog")
})
