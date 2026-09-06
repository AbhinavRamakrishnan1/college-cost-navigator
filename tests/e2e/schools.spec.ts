import { expect,test } from '@playwright/test'

test('finds, opens, saves, reloads, and removes a school without household data requests',async({page})=>{
  const requests:string[]=[]
  page.on('request',(request)=>{if(request.resourceType()==='fetch'||request.resourceType()==='xhr')requests.push(`${request.url()} ${request.postData()??''}`)})
  await page.goto('/profile');await page.getByRole('button',{name:'Load fictional demo'}).click();await page.getByRole('button',{name:'Save profile'}).click();await expect(page.getByRole('status')).toHaveText('Profile saved locally in this browser.')
  await page.goto('/app/schools');await page.getByLabel('Institution name').fill('Ohio State');await expect(page.getByText('1 result')).toBeVisible()
  await page.getByRole('button',{name:'View details'}).click();await expect(page.getByRole('heading',{name:'Ohio State University-Main Campus',level:2})).toBeVisible();await expect(page.getByText('College Scorecard average net price',{exact:true})).toBeVisible();await expect(page.getByText(/SAI is/)).toContainText('2,069')
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Ohio State University-Main Campus saved locally.')
  await page.reload();const savedSection=page.getByRole('heading',{name:/Saved schools/}).locator('..');await expect(savedSection.getByRole('button',{name:'Ohio State University-Main Campus'})).toBeVisible()
  await savedSection.getByRole('button',{name:'Remove'}).click();await expect(page.getByText('No schools saved on this device.')).toBeVisible()
  expect(requests).toEqual([])
})

test('compares three saved schools with shared values, sorting, removal, and reload persistence',async({page})=>{
  const requests:string[]=[];page.on('request',(request)=>{if(request.resourceType()==='fetch'||request.resourceType()==='xhr')requests.push(`${request.url()} ${request.postData()??''}`)})
  await page.goto('/app/schools')
  for(const query of ['Howard','Massachusetts Institute','Ohio State']){await page.getByLabel('Institution name').fill(query);await page.getByRole('button',{name:'Save',exact:true}).click()}
  await page.getByRole('button',{name:'View details'}).click();const details=page.getByRole('heading',{name:'Ohio State University-Main Campus',level:2}).locator('..');await expect(details.getByText('$30,305',{exact:true})).toBeVisible();await expect(details.getByText('$17,339',{exact:true})).toBeVisible()
  await page.goto('/app/compare');const comparison=page.getByRole('region',{name:'Saved school comparison'});await expect(comparison.locator('article')).toHaveCount(3);await expect(comparison.getByText('$30,305',{exact:true})).toBeVisible();await expect(comparison.getByText('$17,339',{exact:true})).toBeVisible()
  await page.getByLabel('Sort saved schools by').selectOption('cost_low');await expect(comparison.getByRole('heading',{level:2}).allTextContents()).resolves.toEqual(['Ohio State University-Main Campus','Howard University','Massachusetts Institute of Technology'])
  await comparison.getByTestId('comparison-school-204796').getByRole('button',{name:'Remove from comparison'}).click();await expect(comparison.locator('article')).toHaveCount(2)
  await page.reload();await expect(page.getByRole('region',{name:'Saved school comparison'}).locator('article')).toHaveCount(2);await expect(page.getByText('Ohio State University-Main Campus')).toHaveCount(0)
  expect(requests).toEqual([])
})
