import { expect, test, type Page } from "@playwright/test"

const openFreshNewTab = async (page: Page) => {
  await page.goto("/newtab.html")
  await page.evaluate(() => localStorage.clear())
  await page.reload()
}

const mainTitles = (page: Page) =>
  page.locator('section[aria-label="Main widgets"] .board-row h2')

const moreTitles = (page: Page) =>
  page.locator('section[aria-label="More widgets"] .board-row h2')

const moreSection = (page: Page) => page.locator("details.more-section")

test("new tab page renders the default widgets and editing controls", async ({
  page
}) => {
  await openFreshNewTab(page)

  await expect(page.getByRole("heading", { name: "Clockboard" })).toBeVisible()
  await expect(page.getByText("Local time")).toBeVisible()
  await expect(page.getByText("Tomorrow morning")).toBeVisible()
  await expect(page.getByRole("button", { name: "Add clock" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Add countdown" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Edit Local time" })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Move Tomorrow morning up" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Move Tomorrow morning to More" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Reorder Tomorrow morning" })
  ).toBeVisible()
  await expect(moreSection(page)).toHaveCount(0)

  await expect(mainTitles(page)).toHaveText(["Local time", "Tomorrow morning"])
})

test("moving a widget to More reveals the section", async ({ page }) => {
  await openFreshNewTab(page)

  await page.getByRole("button", { name: "Move Tomorrow morning to More" }).click()

  await expect(moreSection(page)).toBeVisible()
  await expect(mainTitles(page)).toHaveText(["Local time"])
  await expect(moreTitles(page)).toHaveText(["Tomorrow morning"])
  await expect(
    page.getByRole("button", { name: "Move Tomorrow morning to Main" })
  ).toBeVisible()
})

test("More can collapse and expand", async ({ page }) => {
  await openFreshNewTab(page)

  await page.getByRole("button", { name: "Move Tomorrow morning to More" }).click()
  await expect(moreSection(page)).toHaveAttribute("open", "")

  await page.locator("summary.more-section__summary").click()
  await expect(moreSection(page)).not.toHaveAttribute("open", "")

  await page.locator("summary.more-section__summary").click()
  await expect(moreSection(page)).toHaveAttribute("open", "")
})

test("ordering persists after reload in both Main and More", async ({
  page
}) => {
  await openFreshNewTab(page)

  await page.getByRole("button", { name: "Add clock" }).click()
  await page.getByLabel("Name").fill("Paris")
  await page.getByLabel("Time zone").fill("Europe/Paris")
  await page.getByRole("button", { name: "Save clock" }).click()

  await page.getByRole("button", { name: "Add clock" }).click()
  await page.getByLabel("Name").fill("Tokyo")
  await page.getByLabel("Time zone").fill("Asia/Tokyo")
  await page.getByRole("button", { name: "Save clock" }).click()

  await page.getByRole("button", { name: "Move Tomorrow morning to More" }).click()
  await page.getByRole("button", { name: "Move Paris to More" }).click()
  await page.getByRole("button", { name: "Move Tokyo up" }).click()
  await page.getByRole("button", { name: "Move Paris up" }).click()

  await expect(mainTitles(page)).toHaveText(["Tokyo", "Local time"])
  await expect(moreTitles(page)).toHaveText(["Paris", "Tomorrow morning"])

  await page.reload()

  await expect(mainTitles(page)).toHaveText(["Tokyo", "Local time"])
  await expect(moreTitles(page)).toHaveText(["Paris", "Tomorrow morning"])
})

test("add clock flow works from the new tab page", async ({ page }) => {
  await openFreshNewTab(page)

  await page.getByRole("button", { name: "Add clock" }).click()
  await expect(page.getByRole("dialog", { name: "Add clock" })).toBeVisible()
  await page.getByLabel("Name").fill("Paris")
  await page.getByLabel("Time zone").fill("Europe/Paris")
  await page.getByRole("button", { name: "Save clock" }).click()

  await expect(page.getByRole("heading", { name: "Paris" })).toBeVisible()
})

test("add and edit countdown works without a time-zone field", async ({ page }) => {
  await openFreshNewTab(page)

  await page.getByRole("button", { name: "Add countdown" }).click()
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

test("edit and delete controls still work for widgets in Main and More", async ({
  page
}) => {
  await openFreshNewTab(page)

  await page.getByRole("button", { name: "Edit Local time" }).click()
  await expect(page.getByRole("dialog", { name: "Edit Local time" })).toBeVisible()
  await expect(page.getByLabel("Name")).toHaveValue("Local time")
  await expect(page.getByLabel("Time zone")).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()

  await page.getByRole("button", { name: "Delete Tomorrow morning" }).click()
  await expect(
    page.getByRole("dialog", { name: "Delete Tomorrow morning?" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Delete widget" }).click()

  await expect(page.getByText("Tomorrow morning")).toHaveCount(0)

  await page.getByRole("button", { name: "Add countdown" }).click()
  await page.getByLabel("Name").fill("Launch")
  await page.getByLabel("When").fill("2026-01-02T09:00")
  await page.getByRole("button", { name: "Save countdown" }).click()

  await page.getByRole("button", { name: "Move Launch to More" }).click()
  await page.getByRole("button", { name: "Edit Launch" }).click()
  await expect(page.getByRole("dialog", { name: "Edit Launch" })).toBeVisible()
  await page.getByLabel("Name").fill("Launch later")
  await page.getByRole("button", { name: "Save changes" }).click()

  await expect(page.getByRole("heading", { name: "Launch later" })).toBeVisible()

  await page.getByRole("button", { name: "Delete Launch later" }).click()
  await page.getByRole("button", { name: "Delete widget" }).click()

  await expect(page.getByText("Launch later")).toHaveCount(0)
})
