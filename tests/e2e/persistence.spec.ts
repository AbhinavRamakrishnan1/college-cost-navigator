import { expect, test } from '@playwright/test'

test('loads the fictional demo and persists it across reload', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') requests.push(`${request.url()} ${request.postData() ?? ''}`)
  })
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Load fictional demo' }).click()
  await expect(page.getByLabel('Student name')).toHaveValue('Maya Rivera')
  await expect(page.getByLabel('Household label')).toHaveValue('Rivera household')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByRole('status')).toHaveText('Profile saved locally in this browser.')
  await page.reload()
  await page.getByRole('button', { name: 'Load saved profile' }).click()
  await expect(page.getByLabel('Student name')).toHaveValue('Maya Rivera')
  expect(requests).toEqual([])
})

test('delete all removes the locally persisted profile', async ({ page }) => {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Load fictional demo' }).click()
  await page.getByRole('button', { name: 'Save profile' }).click()
  await page.goto('/app/settings')
  await expect(page.getByText(/profile for Maya Rivera is saved/i)).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete all local data' }).click()
  await expect(page.getByText('No household profile is saved on this device.')).toBeVisible()
})
