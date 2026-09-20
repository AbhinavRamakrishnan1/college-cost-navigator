import { test,expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { FICTIONAL_DEMO_PROFILE } from '../../src/lib/storage/demoProfile'

test('v1.0.1 two returns survive UI edit/save/reload with no financial traffic',async({page})=>{
  const traffic:string[]=[],logs:string[]=[]
  page.on('request',r=>traffic.push(`${r.url()} ${r.postData()??''}`));page.on('console',m=>logs.push(m.text()))
  await page.goto('/profile');await page.getByRole('button',{name:'Load fictional demo'}).click()
  await page.getByRole('group',{name:'Parent tax return 1',exact:true}).getByLabel('Income earned from work').fill('45000')
  await page.getByRole('button',{name:'Add parent tax return'}).click()
  const second=page.getByRole('group',{name:'Parent tax return 2',exact:true})
  await second.getByLabel('Income earned from work').fill('20123');await second.getByLabel('Tax filing status').selectOption('married_filing_separately')
  await page.getByRole('button',{name:'Save profile'}).click();await expect(page.getByRole('status')).toContainText('Profile saved locally')
  await page.reload();await page.getByRole('button',{name:'Load saved profile'}).click();await expect(second.getByLabel('Income earned from work')).toHaveValue('20123')
  await page.getByRole('group',{name:'Parent tax return 1',exact:true}).getByLabel('Income earned from work').fill('46000')
  await page.getByRole('button',{name:'Save profile'}).click();await expect(page.getByRole('status')).toContainText('Profile saved locally')
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
  await page.goto('/app/aid-estimate');const sai=await page.getByTestId('calculated-sai').textContent();await page.reload();await expect(page.getByTestId('calculated-sai')).toHaveText(sai!)
  expect(traffic.join(' ')).not.toContain('20123');expect(logs.join(' ')).not.toContain('20123')
})

test('v1.0.1 exempt omitted assets remain omitted and accessible',async({page})=>{
  await page.goto('/profile');await page.getByRole('button',{name:'Load fictional demo'}).click();await page.getByLabel('SNAP',{exact:true}).check()
  await page.getByRole('button',{name:'Remove parent asset details'}).click();await page.getByRole('button',{name:'Remove student asset details'}).click()
  await page.getByRole('button',{name:'Save profile'}).click();await expect(page.getByRole('status')).toContainText('Profile saved locally')
  await page.reload();await page.getByRole('button',{name:'Load saved profile'}).click();await expect(page.getByRole('button',{name:'Add parent asset details'})).toBeVisible()
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
  await page.goto('/app/aid-estimate');await expect(page.getByTestId('calculated-sai')).toBeVisible()
})

test('v1.0.1 missing borrower history blocks IBR and legacy Tiered labels',async({page})=>{
  await page.goto('/app/repayment');await page.getByLabel('First disbursement date').fill('2025-06-30');await page.getByLabel('Actual fixed APR (%) — optional').fill('6.5');await page.getByLabel('Verified legacy IBR cohort').selectOption('new');await page.getByLabel('Stored IBR 10-year entry cap').fill('250');await page.getByLabel('Eligible balance at IBR entry').fill('20000')
  await page.getByRole('button',{name:'Save loan scenario'}).click();await expect(page.getByTestId('loan-scenario')).toContainText('Cannot determine eligibility')
  await page.getByTestId('loan-scenario').getByRole('button',{name:'Edit'}).click();await page.getByLabel('Direct borrowing on or after July 1, 2026').selectOption('none');await page.getByRole('button',{name:'Update loan scenario'}).click()
  await expect(page.getByTestId('loan-scenario')).toContainText('Legacy Standard, not Tiered Standard');await expect(page.getByTestId('loan-scenario')).toContainText('240 qualifying-payment')
  await page.reload();await expect(page.getByTestId('loan-scenario')).toContainText('Legacy Standard, not Tiered Standard')
})

test('v1.0.1 upgrades real v4 IndexedDB and keeps legacy defaults incomplete',async({page})=>{
  // Establish the production origin without booting the app/Dexie at the current version first.
  await page.goto('/favicon.svg')
  const prior={...FICTIONAL_DEMO_PROFILE,id:'current-household',schemaVersion:2,state:'Alaska',updatedAt:'2026-09-19T00:00:00.000Z'}
  await page.evaluate(profile=>new Promise<void>((resolve,reject)=>{
    const request=indexedDB.open('college-cost-aid-navigator',40)
    request.onupgradeneeded=()=>{for(const [name,keyPath]of [['profiles','id'],['metadata','id'],['savedSchools','unitId'],['loanScenarios','id'],['projectionAssumptions','scenarioId']]){const store=request.result.createObjectStore(name,{keyPath});if(name==='profiles'||name==='loanScenarios')store.createIndex('updatedAt','updatedAt');if(name==='savedSchools')store.createIndex('addedAt','addedAt')}}
    request.onerror=()=>reject(new Error('Synthetic migration setup failed'))
    request.onsuccess=()=>{const db=request.result,tx=db.transaction('profiles','readwrite');tx.objectStore('profiles').put(profile);tx.oncomplete=()=>{db.close();resolve()}}
  }),prior)
  await page.goto('/app/aid-estimate');await expect(page.getByText('Incomplete: financial inputs required')).toBeVisible();await expect(page.getByTestId('calculated-sai')).toHaveCount(0)
  await page.goto('/profile');await page.getByRole('button',{name:'Load saved profile'}).click();await expect(page.getByLabel('State or location')).toHaveValue('AK');await expect(page.getByText('Prior-version inputs retained for review')).toBeVisible()
})
