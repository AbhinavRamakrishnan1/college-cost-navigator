import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('methodology details and policy history are accessible and dated', async ({ page }) => {
  await page.goto('/methodology')
  for (const id of ['sai','assets','pell','scorecard','comparison','repayment','tiered','rap','ibr','rates','projections','privacy']) {
    const section = page.locator(`section#${id}`)
    await expect(section.getByRole('heading').first()).toBeVisible()
    await section.locator('summary').click()
  }
  await expect(page.locator('#scorecard')).toContainText('national institution snapshot contains 6273 records')
  await expect(page.locator('#rates')).toContainText('6.52%')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.goto('/policy-changes')
  await expect(page.getByText('Unresolved / litigated', { exact: true })).toBeVisible()
  await expect(page.locator('ol time')).toHaveCount(9)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('result methodology links resolve to actual sections', async ({ page }) => {
  for (const [route, anchors] of [
    ['/app/aid-estimate', ['sai', 'pell']],
    ['/app/schools', ['scorecard']],
    ['/app/compare', ['comparison']],
    ['/app/repayment', ['repayment']],
  ] as const) {
    for (const anchor of anchors) {
      await page.goto(route)
      await page.locator(`a[href="/methodology#${anchor}"]`).click()
      await expect(page).toHaveURL(new RegExp(`/methodology#${anchor}$`))
      await expect(page.locator(`section#${anchor}`)).toBeVisible()
    }
  }
})
