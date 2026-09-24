import AxeBuilder from '@axe-core/playwright'
import { expect,test } from '@playwright/test'

test('About and Aid Offer Decoder are navigable and accessible',async({page})=>{
  await page.goto('/about')
  await expect(page.getByRole('heading',{name:'About the Builder'})).toBeVisible()
  await expect(page.getByText(/My name is Abhinav Ramakrishnan/)).toBeVisible()
  await expect(page.getByText('College Cost & Aid Navigator is a standalone tool and is not endorsed or sponsored by the U.S. Department of Education, Federal Student Aid or any of the colleges in this application.')).toBeVisible()
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
  await page.getByRole('link',{name:'Aid offer decoder'}).first().click()
  await expect(page.getByRole('heading',{name:/Read an aid offer/})).toBeVisible()
  await expect(page.getByText(/Work-study/).first()).toBeVisible()
  await expect(page.getByText(/owed by the parent borrower/)).toBeVisible()
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
})

test('final funding tools remain factual, accessible, ephemeral, and private',async({page})=>{
  const traffic:string[]=[],logs:string[]=[]
  page.on('request',request=>traffic.push(`${request.method()} ${request.url()} ${request.postData()??''}`))
  page.on('console',message=>logs.push(message.text()))
  await page.goto('/profile');await page.getByRole('button',{name:'Load fictional demo'}).click();await page.getByRole('button',{name:'Save profile'}).click()
  await page.goto('/app/schools');await page.getByLabel('Institution name').fill('Ohio State University-Main Campus');const row=page.getByRole('region',{name:'Find a school'}).getByRole('listitem').filter({has:page.getByText('Ohio State University-Main Campus',{exact:true})});await row.getByRole('button',{name:'Save',exact:true}).click();await row.getByRole('button',{name:'View details'}).click();await page.getByRole('link',{name:'Plan funding for this school'}).click()
  await page.getByLabel('Program identifier').fill('BA-FINAL');await page.getByLabel('Program structure').selectOption('supported');await page.getByLabel('Education level').selectOption('undergraduate');await page.getByLabel('Enrollment and academic-year structure').selectOption('full_time_standard_academic_year')
  await page.getByRole('button',{name:/8\. Funding/}).click();await expect(page.getByRole('heading',{name:'Funding timeline'})).toBeVisible();await expect(page.getByText(/Unknown values are not shown as \$0/).first()).toBeVisible()
  await page.getByRole('button',{name:/10\. Compare/}).click();await expect(page.getByRole('heading',{name:'Plan completeness'})).toBeVisible();await expect(page.getByRole('heading',{name:'Decision Season Checklist'})).toBeVisible();const checklist=page.getByRole('checkbox',{name:'Compare the official financial-aid offer'});await checklist.focus();await page.keyboard.press('Space');await expect(page.getByText('1 of 16 checklist items reviewed')).toBeVisible()
  await page.getByRole('button',{name:'Duplicate current plan as a what-if scenario'}).click();await page.getByRole('button',{name:/2\. Cost/}).click();await page.locator('#totalCost-amount').fill('41000');await page.getByRole('button',{name:/10\. Compare/}).click();await expect(page.getByRole('heading',{name:'Baseline vs What-if scenario'})).toBeVisible();await expect(page.getByText(/No scenario is ranked or recommended/)).toBeVisible();await expect(page.getByRole('link',{name:'Explore repayment scenarios'})).toHaveCount(0)
  expect(page.url()).not.toContain('41000');expect(traffic.join(' ')).not.toContain('41000');expect(logs.join(' ')).not.toContain('41000');expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0})
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
  await page.reload();await expect(page.getByLabel('Ohio State University-Main Campus (OH)')).not.toBeChecked();await expect(page.getByText('Baseline vs What-if scenario')).toHaveCount(0)
})

test('repayment handoff carries no balance or portfolio state in the URL',async({page})=>{
  await page.goto('/app/funding-planner');await page.getByRole('button',{name:/9\. Graduation/}).click();const link=page.getByRole('link',{name:'Explore repayment scenarios'});await expect(link).toHaveAttribute('href','/app/repayment');await link.click();await expect(page).toHaveURL(/\/app\/repayment$/);expect(page.url()).not.toContain('?');expect(page.url()).not.toContain('#')
})
