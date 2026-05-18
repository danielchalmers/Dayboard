import { expect, test, type Page, type TestInfo } from "@playwright/test"

const STORAGE_KEY = "clockboard-state"
const STORY_NOW = "2025-05-09T15:24:00.000Z"

const storyState = {
  widgets: [
    {
      id: "austin",
      kind: "clock",
      title: "Austin",
      placement: "main",
      settings: {
        timeZone: "America/Chicago"
      },
      createdAt: STORY_NOW,
      updatedAt: STORY_NOW
    },
    {
      id: "new-york",
      kind: "clock",
      title: "New York",
      placement: "main",
      settings: {
        timeZone: "America/New_York"
      },
      createdAt: STORY_NOW,
      updatedAt: STORY_NOW
    },
    {
      id: "london",
      kind: "clock",
      title: "London",
      placement: "main",
      settings: {
        timeZone: "Europe/London"
      },
      createdAt: STORY_NOW,
      updatedAt: STORY_NOW
    },
    {
      id: "tokyo",
      kind: "clock",
      title: "Tokyo",
      placement: "main",
      settings: {
        timeZone: "Asia/Tokyo"
      },
      createdAt: STORY_NOW,
      updatedAt: STORY_NOW
    },
    {
      id: "weekend-getaway",
      kind: "countdown",
      title: "Weekend getaway",
      placement: "main",
      settings: {
        targetAt: "2025-05-17T13:00:00.000Z"
      },
      createdAt: STORY_NOW,
      updatedAt: STORY_NOW
    },
    {
      id: "summer-vacation",
      kind: "countdown",
      title: "Summer vacation",
      placement: "main",
      settings: {
        targetAt: "2025-06-28T13:00:00.000Z"
      },
      createdAt: STORY_NOW,
      updatedAt: STORY_NOW
    },
    {
      id: "emma-birthday",
      kind: "countdown",
      title: "Emma's birthday",
      placement: "main",
      settings: {
        targetAt: "2025-07-14T05:00:00.000Z"
      },
      createdAt: STORY_NOW,
      updatedAt: STORY_NOW
    },
    {
      id: "christmas",
      kind: "countdown",
      title: "Christmas",
      placement: "main",
      settings: {
        targetAt: "2025-12-25T06:00:00.000Z"
      },
      createdAt: STORY_NOW,
      updatedAt: STORY_NOW
    }
  ]
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

const openStoryBoard = async (page: Page) => {
  await freezeTime(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/newtab.html")
  await page.evaluate(
    ({ key, state }) => localStorage.setItem(key, JSON.stringify(state)),
    {
      key: STORAGE_KEY,
      state: storyState
    }
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

test("captures Clockboard product screenshots", async ({ page }, testInfo) => {
  await openStoryBoard(page)

  await attachScreenshot(testInfo, page, "clockboard-main-desktop")

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
  await page.getByRole("button", { name: "Edit New York" }).click()
  await expect(page.getByRole("dialog", { name: "Edit clock" })).toBeVisible()
  await attachScreenshot(testInfo, page, "clockboard-edit-clock-dialog")
  await page.getByRole("button", { name: "Cancel" }).click()

  await openWidgetMenu(page, "Summer vacation")
  await page.getByRole("button", { name: "Edit Summer vacation" }).click()
  await expect(
    page.getByRole("dialog", { name: "Edit countdown" })
  ).toBeVisible()
  await attachScreenshot(testInfo, page, "clockboard-edit-countdown-dialog")
})
