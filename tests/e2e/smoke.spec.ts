import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const routes = ['/', '/how-it-works', '/methodology', '/aid-offer-decoder', '/policy-changes', '/privacy', '/about', '/profile', '/app/aid-estimate', '/app/schools', '/app/compare', '/app/funding-planner', '/app/repayment', '/app/summary', '/app/settings']

for (const route of routes) {
  test(`${route} loads and has no detectable accessibility violations`, async ({ page }) => {
    await page.goto(route)
    await expect(page.locator('h1')).toBeVisible()
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
}
