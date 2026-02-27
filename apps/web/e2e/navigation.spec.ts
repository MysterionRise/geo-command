import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should redirect root to dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/sign-in|dashboard/)
  })

  test('should show sign-in page', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page).toHaveURL(/sign-in/)
  })

  test('should show sign-up page', async ({ page }) => {
    await page.goto('/sign-up')
    await expect(page).toHaveURL(/sign-up/)
  })
})
