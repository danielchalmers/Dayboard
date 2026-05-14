import { expect, test } from "@playwright/test"

test("new tab page renders the default board", async ({ page }) => {
  await page.goto("/newtab.html")

  await expect(page.getByRole("heading", { name: "Clockboard" })).toBeVisible()
  await expect(page.getByText("Local time")).toBeVisible()
  await expect(page.getByText("Tomorrow morning")).toBeVisible()
})

test("options page exposes board editing controls", async ({ page }) => {
  await page.goto("/options.html")

  await expect(
    page.getByRole("heading", { name: "Design your board" })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "New clock" })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "New countdown" })
  ).toBeVisible()
  await expect(page.getByLabel("Title")).toHaveValue("Clockboard")
})
