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
  await expect(page.getByRole('status')).toHaveText('Profile saved locally in this browser.')
  await page.goto('/app/settings')
  await expect(page.getByText(/profile for Maya Rivera is saved/i)).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete all local data' }).click()
  await expect(page.getByText('No household profile is saved on this device.')).toBeVisible()
})

test('stored complete inputs calculate identically after reload without network requests', async ({ page }) => {
  const requests: string[]=[]
  page.on('request',(request)=>{if(request.resourceType()==='fetch'||request.resourceType()==='xhr') requests.push(request.url())})
  await page.goto('/profile')
  await page.getByRole('button',{name:'Load fictional demo'}).click()
  await page.getByRole('button',{name:'Save profile'}).click()
  await expect(page.getByRole('status')).toHaveText('Profile saved locally in this browser.')
  await page.goto('/app/aid-estimate')
  await expect(page.getByTestId('calculated-sai')).toHaveText('2,069')
  await expect(page.getByTestId('pell-award')).toHaveText('$5,325')
  await page.reload()
  await expect(page.getByTestId('calculated-sai')).toHaveText('2,069')
  await expect(page.getByTestId('pell-award')).toHaveText('$5,325')
  expect(requests).toEqual([])
})

test('an incomplete stored profile does not guess an estimate', async ({ page }) => {
  await page.goto('/profile')
  await page.getByLabel('Student name').fill('Incomplete Student')
  await page.getByLabel('Household label').fill('Incomplete household')
  await page.getByLabel('State or location').selectOption('OH')
  await page.getByRole('button',{name:'Save profile'}).click()
  await expect(page.getByRole('status')).toHaveText('Profile saved locally in this browser.')
  await page.goto('/app/aid-estimate')
  await expect(page.getByText('Incomplete: financial inputs required')).toBeVisible()
  await expect(page.getByTestId('calculated-sai')).toHaveCount(0)
  await expect(page.getByText('$0',{exact:true})).toHaveCount(0)
})

test('an independent stored profile remains explicitly unsupported', async ({ page }) => {
  await page.goto('/profile')
  await page.getByRole('button',{name:'Load fictional demo'}).click()
  await page.getByLabel('Dependency status').selectOption('independent')
  await page.getByRole('button',{name:'Save profile'}).click()
  await expect(page.getByRole('status')).toHaveText('Profile saved locally in this browser.')
  await page.goto('/app/aid-estimate')
  await expect(page.getByText('Unsupported dependency status')).toBeVisible()
  await expect(page.getByTestId('calculated-sai')).toHaveCount(0)
})
