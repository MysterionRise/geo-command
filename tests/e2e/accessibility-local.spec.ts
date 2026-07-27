import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce" });

test("local Chromium exposes the playable demo at the minimum viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Round 1 of 5")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("no JavaScript exposes explanation only and no partial game controls", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 568 } });
  const page = await context.newPage();
  await page.goto("/");
  expect(await page.locator("body").innerText()).toContain("CodeGuessr needs JavaScript to accept answers and reveal progressive evidence.");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /answer/i })).toHaveCount(0);
  await context.close();
});
