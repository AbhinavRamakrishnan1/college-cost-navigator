import { render,screen,within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe,expect,it } from 'vitest'
import { calculateDependentSai,calculateProfileAid } from '../lib/calculations'
import { FICTIONAL_DEMO_PROFILE } from '../lib/storage/demoProfile'
import { householdProfileSchema } from '../lib/storage/schema'
import { SaiCalculationTrace } from './AidCalculationTrace'

const rivera=()=>householdProfileSchema.parse({...structuredClone(FICTIONAL_DEMO_PROFILE),id:'current-household',schemaVersion:3,updatedAt:'2026-09-19T00:00:00Z'})

describe('SAI calculation trace',()=>{
  it('shows Rivera canonical worksheet values and final SAI 2,069',async()=>{const result=calculateProfileAid(rivera());expect(result.status).toBe('calculated');if(result.status!=='calculated')return;render(<MemoryRouter><SaiCalculationTrace result={result.sai}/></MemoryRouter>);await userEvent.click(screen.getByText('Show how we calculated your SAI'));const trace=screen.getByTestId('sai-trace');expect(trace).toHaveTextContent('Parent adjusted available income');expect(trace).toHaveTextContent('Final bounded SAI');expect(trace).toHaveTextContent('2,069');expect(within(trace).getByText('Final parent contribution').closest('div')).toHaveTextContent('$1,669')})
  it('explains asset exemption without fabricated asset rows',async()=>{const profile=rivera();profile.calculation!.meansTestedBenefits2024or2025=['SNAP'];delete profile.calculation!.parentAssets;delete profile.calculation!.studentAssets;const result=calculateProfileAid(profile);expect(result.status).toBe('calculated');if(result.status!=='calculated')return;render(<MemoryRouter><SaiCalculationTrace result={result.sai}/></MemoryRouter>);await userEvent.click(screen.getByText('Show how we calculated your SAI'));expect(screen.getByText('Assets were not included')).toBeVisible();expect(screen.queryByText('Reportable parent assets')).not.toBeInTheDocument();expect(screen.queryByText('Reportable student assets')).not.toBeInTheDocument()})
  it('keeps a negative final SAI negative in the trace',async()=>{const result=calculateDependentSai({dependencyStatus:'dependent',familySize:2,parentIncome:{agi:0},studentIncome:{agi:0},assetExemption:{qualifiesForMaximumPell:true,parentAgi:0,filedSchedulesA_B_D_E_F_H:false,scheduleC:'not_filed',receivedMeansTestedBenefit:false,parentsLiveOutsideUs:false,parentsFiledUsOrTerritoryReturn:true,nonfilingBelowFilingThreshold:false}});expect(result.status).toBe('calculated');if(result.status!=='calculated')return;render(<MemoryRouter><SaiCalculationTrace result={result}/></MemoryRouter>);await userEvent.click(screen.getByText('Show how we calculated your SAI'));const final=screen.getByText('Final bounded SAI').closest('div')!;expect(final).toHaveTextContent('-1,500')})
})
