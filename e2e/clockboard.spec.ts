import { expect, test, type Page } from "@playwright/test"

const openFreshNewTab = async (page: Page) => {
  await page.goto("/newtab.html")
  await page.evaluate(() => localStorage.clear())
  await page.reload()
}

test("new tab page renders the default widgets and editing controls", async ({
  page
}) => {
  await openFreshNewTab(page)

  await expect(page.getByRole("heading", { name: "Clockboard" })).toBeVisible()
  await expect(page.getByText("Local time")).toBeVisible()
  await expect(page.getByText("Tomorrow morning")).toBeVisible()
  await expect(page.getByRole("button", { name: "Add widget" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Edit Local time" })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Move Tomorrow morning up" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Reorder Tomorrow morning" })
  ).toBeVisible()

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(["Local time", "Tomorrow morning"])
})

test("reordering changes the visible order and persists after reload", async ({
  page
}) => {
  await openFreshNewTab(page)

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(["Local time", "Tomorrow morning"])
  await expect(
    page.getByRole("button", { name: "Reorder Tomorrow morning" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Move Tomorrow morning up" }).click()

  await expect(titles).toHaveText(["Tomorrow morning", "Local time"])

  await page.reload()

  await expect(titles).toHaveText(["Tomorrow morning", "Local time"])
})

test("add clock flow works from the new tab page", async ({ page }) => {
  await openFreshNewTab(page)

  await page.getByRole("button", { name: "Add widget" }).click()
  await expect(page.getByRole("dialog", { name: "Add widget" })).toBeVisible()
  await page.getByRole("button", { name: "Clock" }).click()
  await expect(page.getByRole("dialog", { name: "Add clock" })).toBeVisible()
  await page.getByLabel("Name").fill("Paris")
  await page.getByLabel("Time zone").fill("Europe/Paris")
  await page.getByRole("button", { name: "Save clock" }).click()

  await expect(page.getByRole("heading", { name: "Paris" })).toBeVisible()
})

test("add and edit countdown works without a time-zone field", async ({ page }) => {
  await openFreshNewTab(page)

  await page.getByRole("button", { name: "Add widget" }).click()
  await expect(page.getByRole("dialog", { name: "Add widget" })).toBeVisible()
  await page.getByRole("button", { name: "Countdown" }).click()
  await expect(page.getByRole("dialog", { name: "Add countdown" })).toBeVisible()
  await expect(page.getByLabel("Time zone")).toHaveCount(0)
  await page.getByLabel("Name").fill("Launch")
  await page.getByLabel("When").fill("2026-01-02T09:00")
  await page.getByRole("button", { name: "Save countdown" }).click()

  await expect(page.getByRole("heading", { name: "Launch" })).toBeVisible()
  await page.getByRole("button", { name: "Edit Launch" }).click()
  await expect(page.getByRole("dialog", { name: "Edit Launch" })).toBeVisible()
  await expect(page.getByLabel("Time zone")).toHaveCount(0)
  await page.getByLabel("Name").fill("Launch day")
  await page.getByRole("button", { name: "Save changes" }).click()

  await expect(page.getByRole("heading", { name: "Launch day" })).toBeVisible()
})

test("edit dialog opens for an existing clock", async ({ page }) => {
  await openFreshNewTab(page)

  await page.getByRole("button", { name: "Edit Local time" }).click()
  await expect(page.getByRole("dialog", { name: "Edit Local time" })).toBeVisible()
  await expect(page.getByLabel("Name")).toHaveValue("Local time")
  await expect(page.getByLabel("Time zone")).toBeVisible()
})

test("delete flow removes an existing widget", async ({ page }) => {
  await openFreshNewTab(page)

  await page.getByRole("button", { name: "Delete Tomorrow morning" }).click()
  await expect(
    page.getByRole("dialog", { name: "Delete Tomorrow morning?" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Delete widget" }).click()

  await expect(page.getByText("Tomorrow morning")).toHaveCount(0)
})

test("edit and delete controls still work after reordering", async ({ page }) => {
  await openFreshNewTab(page)

  await page.getByRole("button", { name: "Move Tomorrow morning up" }).click()

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(["Tomorrow morning", "Local time"])

  await page.getByRole("button", { name: "Edit Tomorrow morning" }).click()
  await expect(
    page.getByRole("dialog", { name: "Edit Tomorrow morning" })
  ).toBeVisible()
  await page.getByLabel("Name").fill("Morning plans")
  await page.getByRole("button", { name: "Save changes" }).click()

  await expect(page.getByRole("heading", { name: "Morning plans" })).toBeVisible()

  await page.getByRole("button", { name: "Delete Morning plans" }).click()
  await page.getByRole("button", { name: "Delete widget" }).click()

  await expect(page.getByText("Morning plans")).toHaveCount(0)
})

test("settings and More placement are available from the new tab page", async ({
  page
}) => {
  await openFreshNewTab(page)

  await page.getByRole("button", { name: "Settings" }).click()
  await expect(
    page.getByRole("dialog", { name: "Clockboard settings" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Done" }).click()

  await page.getByRole("button", { name: "Move Tomorrow morning to More" }).click()
  await expect(page.getByRole("button", { name: "More" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Move Tomorrow morning to Main" })).toBeVisible()

  await page.reload()

  await expect(page.getByRole("button", { name: "More" })).toBeVisible()
  await page.getByRole("button", { name: "More" }).click()
  await expect(
    page.getByRole("button", { name: "Move Tomorrow morning to Main" })
  ).toBeVisible()
})
