import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { expect,test } from '@playwright/test'

test('production journey: national schools, local backup, delete-all, restore, privacy and CSP',async({page})=>{
  const traffic:string[]=[],logs:string[]=[],csp:string[]=[]
  page.on('request',request=>traffic.push(`${request.method()} ${request.url()} ${request.postData()??''}`))
  page.on('console',message=>{logs.push(message.text());if(message.text().includes('Content Security Policy'))csp.push(message.text())})
  const response=await page.goto('/app/repayment')
  expect(response?.headers()['content-security-policy']).toContain("connect-src 'self'")
  expect(response?.headers()['x-content-type-options']).toBe('nosniff')
  await page.goto('/profile');await page.getByRole('button',{name:'Load fictional demo'}).click();await page.getByRole('button',{name:'Save profile'}).click();await expect(page.getByRole('status')).toHaveText('Profile saved locally in this browser.')
  await page.goto('/app/aid-estimate');await expect(page.getByTestId('calculated-sai')).toHaveText('2,069');await expect(page.getByTestId('pell-award')).toHaveText('$5,325')
  await page.goto('/app/schools')
  for(const name of ['Howard University','Massachusetts Institute of Technology','Ohio State University-Main Campus']){await page.getByLabel('Institution name').fill(name);await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('saved locally')}
  await page.getByLabel('Institution name').fill('Stanford University');await expect(page.getByText('1 result',{exact:true})).toBeVisible()
  await page.goto('/app/compare');await expect(page.getByRole('region',{name:'Saved school comparison'}).locator('article')).toHaveCount(3)
  await page.goto('/app/repayment');await page.getByLabel('Principal',{exact:true}).fill('23456.78');await page.getByLabel('Borrower AGI').fill('45678.91');await page.getByRole('button',{name:'Save loan scenario'}).click();await expect(page.getByTestId('loan-scenario')).toHaveCount(1);await page.reload();await expect(page.getByTestId('loan-scenario')).toHaveCount(1)
  await page.goto('/app/settings')
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download backup'}).click();const download=await downloadPromise,backup=await readFile((await download.path())!,'utf8')
  expect(JSON.parse(backup).data.savedSchools).toHaveLength(3)
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Delete all local data'}).click();await expect(page.getByText(/profile for Maya Rivera/)).toBeVisible()
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete all local data'}).click();await expect(page.getByText('No household profile is saved on this device.')).toBeVisible()
  await page.getByLabel('Restore backup file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await expect(page.getByRole('status')).toContainText('Backup not restored')
  page.once('dialog',async dialog=>{expect(dialog.message()).toContain('3 saved schools');await dialog.accept()})
  await page.getByLabel('Restore backup file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)})
  await expect(page.getByRole('status')).toContainText('Backup restored: 1 profile, 3 saved schools, and 1 loan scenarios.')
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
  await page.goto('/app/aid-estimate');await expect(page.getByTestId('calculated-sai')).toHaveText('2,069')
  await page.goto('/app/compare');await expect(page.getByRole('region',{name:'Saved school comparison'}).locator('article')).toHaveCount(3)
  expect(traffic.every(value=>value.startsWith('GET http://127.0.0.1:4173/'))).toBe(true)
  for(const sentinel of ['23456.78','2345678','45678.91','4567891','Rivera','65000']){expect(traffic.join(' ')).not.toContain(sentinel);expect(logs.join(' ')).not.toContain(sentinel)}
  expect(csp).toEqual([])
})

test('joint RAP requires deliberate spouse-debt assumptions and persists the selection',async({page})=>{
  await page.goto('/app/repayment');await page.getByLabel('Tax/relationship status').selectOption('married_filing_jointly')
  await page.getByRole('button',{name:'Save loan scenario'}).click();await expect(page.getByTestId('loan-scenario')).toContainText('An explicit spouse eligible-debt projection')
  await page.getByTestId('loan-scenario').getByRole('button',{name:'Edit'}).click()
  await page.getByLabel('Spouse debt projection assumption').selectOption('constant');await page.getByRole('button',{name:'Update loan scenario'}).click()
  await expect(page.getByTestId('loan-scenario')).toContainText('spouse eligible debt is assumed constant by your explicit selection')
  await page.reload();await page.getByTestId('loan-scenario').getByRole('button',{name:'Edit'}).click();await expect(page.getByLabel('Spouse debt projection assumption')).toHaveValue('constant')
})

test('malformed local data and unavailable storage have safe states',async({page})=>{
  await page.goto('/profile');await page.getByRole('button',{name:'Load fictional demo'}).click();await page.getByRole('button',{name:'Save profile'}).click();await expect(page.getByRole('status')).toContainText('Profile saved locally')
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('college-cost-aid-navigator');request.onerror=()=>reject();request.onsuccess=()=>{const db=request.result,tx=db.transaction('profiles','readwrite');tx.objectStore('profiles').put({id:'current-household',calculation:{}});tx.oncomplete=()=>{db.close();resolve()}}}))
  await page.goto('/app/aid-estimate');await expect(page.getByRole('heading',{name:'This view is unavailable'})).toBeVisible();await expect(page.getByTestId('calculated-sai')).toHaveCount(0)
  await page.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{get(){throw new Error('Storage disabled')}})})
  await page.goto('/app/repayment');await expect(page.getByRole('heading',{name:'This view is unavailable'})).toBeVisible()
})

test('school reference-load failure does not fabricate results',async({page})=>{
  await page.route('**/scorecard/*.json',route=>route.fulfill({status:503,body:'unavailable'}))
  await page.goto('/app/schools');await expect(page.getByRole('heading',{name:'This view is unavailable'})).toBeVisible()
})

for(const [store,route,record] of [
  ['savedSchools','/app/compare',{unitId:123,name:'Invalid'}],
  ['loanScenarios','/app/repayment',{id:'invalid',updatedAt:'2026-09-18T00:00:00.000Z',principalCents:'not money'}],
] as const)test(`malformed ${store} is fail-closed`,async({page})=>{
  await page.goto('/profile');await page.getByRole('button',{name:'Load fictional demo'}).click();await page.getByRole('button',{name:'Save profile'}).click();await expect(page.getByRole('status')).toContainText('Profile saved locally')
  await page.evaluate(({store,record})=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('college-cost-aid-navigator');request.onerror=()=>reject();request.onsuccess=()=>{const db=request.result,tx=db.transaction(store,'readwrite');tx.objectStore(store).put(record);tx.oncomplete=()=>{db.close();resolve()}}}),{store,record})
  await page.goto(route);await expect(page.getByRole('heading',{name:'This view is unavailable'})).toBeVisible()
})

test('keyboard skip link, mobile Escape, narrow reflow and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/')
  await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#main-content')).toBeFocused()
  await page.setViewportSize({width:640,height:800})
  await page.getByRole('button',{name:'Menu',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Menu',exact:true})).toBeFocused()
  for(const route of ['/methodology','/profile','/app/repayment','/app/settings']){
    await page.goto(route);await expect(page.locator('h1')).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true)
  }
})

test('database version/open failure has an explicit recovery state',async({page})=>{
  await page.goto('/')
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('college-cost-aid-navigator',100);request.onupgradeneeded=()=>request.result.createObjectStore('future');request.onerror=()=>reject();request.onsuccess=()=>{request.result.close();resolve()}}))
  await page.goto('/profile');await expect(page.getByRole('heading',{name:'This view is unavailable'})).toBeVisible()
})
