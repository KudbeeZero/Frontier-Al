import { test, expect } from '@playwright/test'

// You can override the default Playwright test timeout of 30s
// test.setTimeout(60_000);

test('Custom Browser Check', async ({ page }) => {
  // MIGRATION: hardcoded Replit URL replaced with PUBLIC_BASE_URL
  const response = await page.goto(process.env.PUBLIC_BASE_URL ?? 'https://ascendancyalgo.xyz/')
  expect(response?.status()).toBeLessThan(400)
  await page.screenshot({ path: 'screenshot.jpg' })
})