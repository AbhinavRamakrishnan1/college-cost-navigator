import AxeBuilder from '@axe-core/playwright'
import { expect,test } from '@playwright/test'

test('creates post-cutoff and legacy Direct Loan scenarios, persists, edits, and deletes locally',async({page})=>{
  const networkPayloads:string[]=[],consoleMessages:string[]=[]
  page.on('request',request=>{if(request.resourceType()==='fetch'||request.resourceType()==='xhr')networkPayloads.push(`${request.url()} ${request.postData()??''}`)})
  page.on('console',message=>consoleMessages.push(message.text()))
  await page.goto('/app/repayment')
  await page.getByLabel('Principal').fill('23456.78')
  await page.getByLabel('Borrower AGI').fill('45678.91')
  await page.getByRole('button',{name:'Save loan scenario'}).click()
  await expect(page.getByRole('status')).toHaveText('Loan scenario saved locally.')
  const post=page.getByTestId('loan-scenario').filter({hasText:'2026 undergraduate loan'})
  await expect(post.getByRole('heading',{name:'Tiered Standard'})).toBeVisible()
  await expect(post.getByRole('heading',{name:'RAP'})).toBeVisible()
  await expect(post.getByRole('heading',{name:'IBR'})).toBeVisible()
  await expect(post.getByText('IBR is unavailable for Direct Loans made on or after July 1, 2026.')).toBeVisible()
  await page.reload();await expect(page.getByText('2026 undergraduate loan')).toBeVisible()

  await page.getByLabel('Scenario name').fill('Legacy IBR loan')
  await page.getByLabel('First disbursement date').fill('2025-06-30')
  await page.getByLabel('Actual fixed APR (%) — optional').fill('6.5')
  await page.getByLabel('Verified legacy IBR cohort').selectOption('new')
  await page.getByLabel('Stored IBR 10-year entry cap').fill('250')
  await page.getByLabel('Eligible balance at IBR entry').fill('23456.78')
  await page.getByRole('button',{name:'Save loan scenario'}).click()
  const legacy=page.getByTestId('loan-scenario').filter({hasText:'Legacy IBR loan'})
  await expect(legacy.getByRole('heading',{name:'IBR (new)'})).toBeVisible()
  await expect(legacy.getByText('240 qualifying-payment forgiveness horizon; forgiveness is not guaranteed.')).toBeVisible()
  await legacy.getByRole('button',{name:'Edit'}).click();await page.getByLabel('Verified legacy IBR cohort').selectOption('old');await page.getByRole('button',{name:'Update loan scenario'}).click()
  await expect(page.getByTestId('loan-scenario').filter({hasText:'Legacy IBR loan'}).getByRole('heading',{name:'IBR (old)'})).toBeVisible()
  await page.reload();await expect(page.getByTestId('loan-scenario')).toHaveCount(2)
  // Re-resolve the first card after each removal; index locators shift as rows disappear.
  for(let remaining=2;remaining>0;remaining--){
    await page.getByTestId('loan-scenario').first().getByRole('button',{name:'Delete'}).click()
    await expect(page.getByTestId('loan-scenario')).toHaveCount(remaining-1)
  }
  await expect(page.getByText('No loan scenarios are stored on this device.')).toBeVisible()
  expect(networkPayloads).toEqual([])
  expect(consoleMessages.join(' ')).not.toContain('23456.78');expect(consoleMessages.join(' ')).not.toContain('45678.91')
})

test('repayment form and results have no automatically detectable accessibility violations',async({page})=>{
  await page.goto('/app/repayment');await page.getByRole('button',{name:'Save loan scenario'}).click();await expect(page.getByTestId('loan-scenario')).toHaveCount(1)
  const results=await new AxeBuilder({page}).analyze();expect(results.violations).toEqual([])
})
