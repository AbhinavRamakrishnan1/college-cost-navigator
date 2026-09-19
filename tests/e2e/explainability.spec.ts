import AxeBuilder from '@axe-core/playwright'
import { expect,test } from '@playwright/test'

test('Rivera explanation journey stays local and supports bracket override and next steps',async({page})=>{
  const traffic:string[]=[],logs:string[]=[]
  page.on('request',request=>traffic.push(`${request.method()} ${request.url()} ${request.postData()??''}`));page.on('console',message=>logs.push(message.text()))
  await page.goto('/profile');await page.getByRole('button',{name:'Load fictional demo'}).click();await page.getByRole('button',{name:'Save profile'}).click();await expect(page.getByRole('status')).toContainText('Profile saved locally')
  await page.getByRole('link',{name:'Estimate federal aid'}).click();await expect(page.getByTestId('calculated-sai')).toHaveText('2,069');await expect(page.getByTestId('pell-award')).toHaveText('$5,325')
  const pellDefinition=page.getByLabel('About Pell Grant');await pellDefinition.focus();await page.keyboard.press('Enter');await expect(pellDefinition.locator('xpath=..').getByRole('link',{name:'Learn more'})).toBeVisible();await pellDefinition.click()
  const sai=page.getByTestId('sai-trace'),pell=page.getByTestId('pell-trace')
  await sai.locator(':scope > summary').focus();await page.keyboard.press('Enter');await expect(sai).toHaveAttribute('open','');await expect(sai).toContainText('Parent adjusted available income');await expect(sai).toContainText('Final bounded SAI')
  await pell.locator(':scope > summary').focus();await page.keyboard.press('Enter');await expect(pell).toHaveAttribute('open','');await expect(pell).toContainText('Calculated Pell path');await expect(pell).toContainText('$5,325')
  await expect(page.getByText('This is a federal aid estimate, not your complete financial aid package.')).toBeVisible();expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
  await page.getByRole('link',{name:'Search colleges'}).click();await page.getByLabel('Institution name').fill('Ohio State University-Main Campus');await page.getByRole('button',{name:'View details'}).click()
  await expect(page.getByText('Suggested locally from the complete household profile: $48,001–$75,000')).toBeVisible();await expect(page.getByLabel('Selected family income bracket')).toHaveValue('48001-75000');await expect(page.getByTestId('selected-bracket-price')).toHaveText('$9,807')
  await page.getByLabel('Selected family income bracket').selectOption('0-30000');await expect(page.getByTestId('selected-bracket-price')).toHaveText('$4,885');expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('saved locally')
  await page.getByLabel('Institution name').fill('Howard University');const howard=page.getByRole('region',{name:'Find a school'}).getByRole('listitem').filter({has:page.getByText('Howard University',{exact:true})});await howard.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('Howard University saved locally')
  await page.getByRole('link',{name:'Compare saved schools'}).click();await expect(page.getByLabel('Federal income bracket')).toHaveValue('48001-75000');await expect(page.getByRole('region',{name:'Saved school comparison'}).locator('article')).toHaveCount(2)
  await page.getByRole('link',{name:'Explore repayment'}).click();await expect(page.getByRole('heading',{name:'Estimate Direct Loan payments under 2026 rules.'})).toBeVisible()
  const joined=traffic.join(' '),consoleText=logs.join(' ');for(const sentinel of ['65000','5000','Rivera']){expect(joined).not.toContain(sentinel);expect(consoleText).not.toContain(sentinel)}
  expect(traffic.filter(value=>value.includes('/scorecard/')).every(value=>value.startsWith('GET http://127.0.0.1:4173/scorecard/'))).toBe(true)
})
