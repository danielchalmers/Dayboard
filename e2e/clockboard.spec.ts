import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const openNewTab = async (page: Page, extensionId: string) => {
  await page.goto(`chrome-extension://${extensionId}/newtab.html`)
  await page.evaluate(() => chrome.storage.sync.clear())
  await page.reload()
}

const dragWidget = async (page: Page, sourceTitle: string, targetTitle: string) => {
  const source = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: sourceTitle }) })
  const target = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: targetTitle }) })

  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()

  if (!sourceBox || !targetBox) {
    throw new Error("Unable to locate widget bounds for dragging")
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 20 }
  )
  await page.mouse.up()
}

const openWidgetMenu = async (page: Page, title: string) => {
  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: title }) })

  await card.click({ button: "right" })
}

test("new tab page renders the default widgets and editing controls", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute(
    "href",
    /icon32\.png$/
  )
  await expect(page.getByRole("heading", { name: "Clockboard" })).toBeVisible()
  await expect(page.getByText("Local time")).toBeVisible()
  await expect(page.getByText("Tomorrow morning")).toBeVisible()
  await expect(page.getByRole("button", { name: "Add widget" })).toBeVisible()
  await expect(page.getByLabel("Actions for Local time")).toHaveCount(0)

  await page.getByRole("button", { name: "Add widget" }).click()
  await expect(page.getByRole("button", { name: "Add clock" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Add countdown" })).toBeVisible()

  await openWidgetMenu(page, "Tomorrow morning")
  await expect(
    page.getByRole("button", { name: "Move Tomorrow morning up" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Reorder Tomorrow morning" })
  ).toHaveCount(0)

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(["Local time", "Tomorrow morning"])
})

test("widget menu spawns under the cursor and breaks free of the card", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Local time" }) })
  const cardBox = await card.boundingBox()

  if (!cardBox) {
    throw new Error("Unable to locate widget bounds")
  }

  // Right-click near the card's bottom-right corner.
  const cursorX = cardBox.x + cardBox.width - 12
  const cursorY = cardBox.y + cardBox.height - 12
  await page.mouse.move(cursorX, cursorY)
  await page.mouse.down({ button: "right" })
  await page.mouse.up({ button: "right" })

  const menu = page.locator(".card-menu")
  await expect(menu).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Edit Local time" })
  ).toBeVisible()

  const menuBox = await menu.boundingBox()

  if (!menuBox) {
    throw new Error("Unable to locate widget menu bounds")
  }

  // The menu opens at the cursor instead of a fixed corner of the card...
  expect(menuBox.x).toBeGreaterThan(cardBox.x + cardBox.width / 2)
  // ...and is allowed to extend past the card's edges rather than being clipped.
  expect(menuBox.x + menuBox.width).toBeGreaterThan(cardBox.x + cardBox.width)
})

test("widget menu stays within the viewport when opened near the screen edge", async ({
  page,
  extensionId
}) => {
  // A narrow viewport keeps the board single-column so a card spans to the right edge.
  await page.setViewportSize({ width: 420, height: 800 })
  await openNewTab(page, extensionId)

  const viewport = page.viewportSize()

  if (!viewport) {
    throw new Error("Unable to determine viewport size")
  }

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Local time" }) })
  const cardBox = await card.boundingBox()

  if (!cardBox) {
    throw new Error("Unable to locate widget bounds")
  }

  // Right-click near the card's right edge, where an unclamped menu would spill off screen.
  const cursorX = cardBox.x + cardBox.width - 6
  const cursorY = cardBox.y + cardBox.height - 6
  await page.mouse.move(cursorX, cursorY)
  await page.mouse.down({ button: "right" })
  await page.mouse.up({ button: "right" })

  const menu = page.locator(".card-menu")
  await expect(menu).toBeVisible()

  // Wait for the scale-up animation to settle so we measure the menu at full size.
  await menu
    .locator(".card-menu__panel")
    .evaluate((panel) =>
      Promise.all(panel.getAnimations().map((animation) => animation.finished))
    )

  const menuBox = await menu.boundingBox()

  if (!menuBox) {
    throw new Error("Unable to locate widget menu bounds")
  }

  // The cursor sat past the right edge minus the menu width, so it must have been clamped back.
  expect(menuBox.x).toBeLessThan(cursorX)
  expect(menuBox.x).toBeGreaterThanOrEqual(0)
  expect(menuBox.y).toBeGreaterThanOrEqual(0)
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width)
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height)
})

test("reordering changes the visible order and persists after reload", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(["Local time", "Tomorrow morning"])
  await dragWidget(page, "Tomorrow morning", "Local time")

  await expect(titles).toHaveText(["Tomorrow morning", "Local time"])

  await page.reload()

  await expect(titles).toHaveText(["Tomorrow morning", "Local time"])
})

test("dropdowns close when clicking outside them", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await expect(page.getByRole("button", { name: "Add clock" })).toBeVisible()
  await page.getByRole("heading", { name: "Clockboard" }).click()
  await expect(page.getByRole("button", { name: "Add clock" })).not.toBeVisible()

  await openWidgetMenu(page, "Tomorrow morning")
  await expect(
    page.getByRole("button", { name: "Move Tomorrow morning up" })
  ).toBeVisible()
  await page.getByRole("heading", { name: "Clockboard" }).click()
  await expect(
    page.getByRole("button", { name: "Move Tomorrow morning up" })
  ).not.toBeVisible()
})

test("add clock flow works from the new tab page", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add clock" }).click()
  await expect(page.getByRole("dialog", { name: "Add clock" })).toBeVisible()
  await page.getByLabel("Name").fill("Paris")
  await page.getByLabel("Time zone").fill("Europe/Paris")
  await page.getByRole("button", { name: "Save clock" }).click()

  await expect(page.getByRole("heading", { name: "Paris" })).toBeVisible()
})

test("multiple open tabs stay synchronized", async ({
  context,
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const secondPage = await context.newPage()
  const thirdPage = await context.newPage()

  await secondPage.goto(`chrome-extension://${extensionId}/newtab.html`)
  await thirdPage.goto(`chrome-extension://${extensionId}/newtab.html`)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add clock" }).click()
  await page.getByLabel("Name").fill("Paris")
  await page.getByLabel("Time zone").fill("Europe/Paris")
  await page.getByRole("button", { name: "Save clock" }).click()

  await expect(secondPage.getByRole("heading", { name: "Paris" })).toBeVisible()
  await expect(thirdPage.getByRole("heading", { name: "Paris" })).toBeVisible()

  await openWidgetMenu(secondPage, "Paris")
  await secondPage.getByRole("button", { name: "Edit Paris" }).click()
  await secondPage.getByLabel("Name").fill("Tokyo")
  await secondPage.getByLabel("Time zone").fill("Asia/Tokyo")
  await secondPage.getByRole("button", { name: "Save changes" }).click()

  await expect(page.getByRole("heading", { name: "Tokyo" })).toBeVisible()
  await expect(thirdPage.getByRole("heading", { name: "Tokyo" })).toBeVisible()

  await openWidgetMenu(thirdPage, "Tokyo")
  await thirdPage.getByRole("button", { name: "Delete Tokyo" }).click()
  await thirdPage.getByRole("button", { name: "Delete widget" }).click()

  await expect(page.getByRole("heading", { name: "Tokyo" })).toHaveCount(0)
  await expect(secondPage.getByRole("heading", { name: "Tokyo" })).toHaveCount(0)

  await secondPage.close()
  await thirdPage.close()
})

test("add and edit countdown works without a time-zone field", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add countdown" }).click()
  await expect(page.getByRole("dialog", { name: "Add countdown" })).toBeVisible()
  await expect(page.getByLabel("Time zone")).toHaveCount(0)
  await page.getByLabel("Name").fill("Launch")
  await page.getByLabel("When").fill("2026-01-02T09:00")
  await page.getByRole("button", { name: "Save countdown" }).click()

  await expect(page.getByRole("heading", { name: "Launch" })).toBeVisible()
  await openWidgetMenu(page, "Launch")
  await page.getByRole("button", { name: "Edit Launch" }).click()
  await expect(page.getByRole("dialog", { name: "Edit countdown" })).toBeVisible()
  await expect(page.getByLabel("Time zone")).toHaveCount(0)
  await page.getByLabel("Name").fill("Launch day")
  await page.getByRole("button", { name: "Save changes" }).click()

  await expect(page.getByRole("heading", { name: "Launch day" })).toBeVisible()
})

test("edit dialog opens for an existing clock", async ({ page, extensionId }) => {
  await openNewTab(page, extensionId)

  await openWidgetMenu(page, "Local time")
  await page.getByRole("button", { name: "Edit Local time" }).click()
  await expect(page.getByRole("dialog", { name: "Edit clock" })).toBeVisible()
  await expect(page.getByLabel("Name")).toHaveValue("Local time")
  await expect(page.getByLabel("Time zone")).toBeVisible()
})

test("delete flow removes an existing widget", async ({ page, extensionId }) => {
  await openNewTab(page, extensionId)

  await openWidgetMenu(page, "Tomorrow morning")
  await page.getByRole("button", { name: "Delete Tomorrow morning" }).click()
  await expect(
    page.getByRole("dialog", { name: "Delete countdown?" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Delete widget" }).click()

  await expect(page.getByText("Tomorrow morning")).toHaveCount(0)
})

test("edit and delete controls still work after reordering", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await dragWidget(page, "Tomorrow morning", "Local time")

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(["Tomorrow morning", "Local time"])

  await openWidgetMenu(page, "Tomorrow morning")
  await page.getByRole("button", { name: "Edit Tomorrow morning" }).click()
  await expect(
    page.getByRole("dialog", { name: "Edit countdown" })
  ).toBeVisible()
  await page.getByLabel("Name").fill("Morning plans")
  await page.getByRole("button", { name: "Save changes" }).click()

  await expect(page.getByRole("heading", { name: "Morning plans" })).toBeVisible()

  await openWidgetMenu(page, "Morning plans")
  await page.getByRole("button", { name: "Delete Morning plans" }).click()
  await page.getByRole("button", { name: "Delete widget" }).click()

  await expect(page.getByText("Morning plans")).toHaveCount(0)
})
