import { render,screen } from '@testing-library/react'
import { describe,expect,it } from 'vitest'
import { PrintSummaryContent } from './PrintSummaryPage'
import { FICTIONAL_DEMO_PROFILE } from '../lib/storage/demoProfile'
import { householdProfileSchema } from '../lib/storage/schema'
import { scorecardSnapshot } from '../lib/scorecard/catalog'

describe('printable household summary',()=>{
  it('includes results and disclaimers without raw financial or internal fields',()=>{const profile=householdProfileSchema.parse({...structuredClone(FICTIONAL_DEMO_PROFILE),id:'current-household',schemaVersion:3,updatedAt:'2026-09-19T00:00:00.000Z'});const {container}=render(<PrintSummaryContent profile={profile} schools={[scorecardSnapshot.records[2]]} generatedAt={new Date('2026-09-19T12:00:00Z')}/>);expect(screen.getByText('2,069')).toBeVisible();expect(screen.getByText(/\$5,325 Scheduled Award estimate/)).toBeVisible();expect(screen.getByText(/not an official aid offer/i)).toBeVisible();expect(screen.getByText(/raw income, tax-return details, asset balances/i)).toBeVisible();for(const forbidden of ['65000','10000','parentIncome','assetExemption','maxPellIndicator','current-household'])expect(container.textContent).not.toContain(forbidden)})
})
