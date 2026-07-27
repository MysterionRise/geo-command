import { expect, test } from "@playwright/test";

test("plays the five-round synthetic code-space demo and restarts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Synthetic local demo/)).toBeVisible();
  await expect(page.getByText("Round 1 of 5")).toBeVisible();

  await page.getByRole("button", { name: "Reveal hint 1" }).click();
  await page.getByLabel("Recorded model output").check();
  await page.getByRole("button", { name: "Lock in answer" }).click();
  await expect(page.getByRole("heading", { name: "Nice read." })).toBeVisible();
  await expect(page.getByLabel(/Score/)).toHaveText("800 pts");

  for (const answer of ["Recorded model output", "Recorded model output", "TypeScript", "Python"]) {
    await page.getByRole("button", { name: "Next round" }).click();
    await page.getByLabel(answer).check();
    await page.getByRole("button", { name: "Lock in answer" }).click();
    await expect(page.getByRole("heading", { name: "Nice read." })).toBeVisible();
  }

  await expect(page.getByText(/Run complete — 4,800 points/)).toBeVisible();
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByText("Round 1 of 5")).toBeVisible();
  await expect(page.getByLabel(/Score/)).toHaveText("0 pts");
});
