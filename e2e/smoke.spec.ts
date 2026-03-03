import { expect, test } from "@playwright/test";

test("loads workbench shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /tile library/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /inspector/i })).toBeVisible();
});
