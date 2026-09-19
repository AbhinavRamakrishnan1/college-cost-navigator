import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest'
import { cleanup,render,screen,within,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HouseholdProfileForm } from './HouseholdProfileForm'
import { navigatorDatabase } from '../lib/storage/database'
import { householdRepository } from '../lib/storage/repositories'
import { BackupService } from '../lib/storage/backup'
import { FICTIONAL_DEMO_PROFILE } from '../lib/storage/demoProfile'
import { calculateProfileAid } from '../lib/calculations/profile'

beforeEach(async()=>{await navigatorDatabase.open();await householdRepository.deleteAll()})
afterEach(async()=>{cleanup();await householdRepository.deleteAll();vi.restoreAllMocks()})
describe('profile application-boundary regressions',()=>{
  it('D6 import → edit → save → reload preserves both tax returns',async()=>{
    const demo=structuredClone(FICTIONAL_DEMO_PROFILE)
    demo.calculation!.parentIncome.workReturns=[{filingStatus:'married_filing_separately',workIncome:45000},{filingStatus:'married_filing_separately',workIncome:20000}]
    await householdRepository.save(demo)
    const backup=new BackupService(),exported=await backup.create();await householdRepository.deleteAll();await backup.restore(exported)
    const user=userEvent.setup();render(<HouseholdProfileForm/>);await user.click(screen.getByRole('button',{name:'Load saved profile'}))
    const first=await screen.findByRole('group',{name:'Parent tax return 1'}),second=screen.getByRole('group',{name:'Parent tax return 2'})
    expect(within(second).getByLabelText('Income earned from work')).toHaveValue(20000)
    await user.clear(within(first).getByLabelText('Income earned from work'));await user.type(within(first).getByLabelText('Income earned from work'),'46000')
    await user.click(screen.getByRole('button',{name:'Save profile'}));await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Profile saved locally'))
    const loaded=(await householdRepository.load())!
    expect(loaded.calculation!.parentIncome.workReturns).toEqual([{filingStatus:'married_filing_separately',workIncome:46000},{filingStatus:'married_filing_separately',workIncome:20000}])
    const expected=structuredClone(exported.data.profiles[0]);expected.calculation!.parentIncome.workReturns[0].workIncome=46000
    expect(calculateProfileAid(loaded)).toEqual(calculateProfileAid(expected))
    cleanup();render(<HouseholdProfileForm/>);await user.click(screen.getByRole('button',{name:'Load saved profile'}));expect(await screen.findByRole('group',{name:'Parent tax return 2'})).toBeInTheDocument()
  })
  it('D7 opens exempt omitted assets without inventing objects',async()=>{
    const p=structuredClone(FICTIONAL_DEMO_PROFILE);p.calculation!.meansTestedBenefits2024or2025=['SNAP'];delete p.calculation!.parentAssets;delete p.calculation!.studentAssets
    await householdRepository.save(p);const user=userEvent.setup();render(<HouseholdProfileForm/>);await user.click(screen.getByRole('button',{name:'Load saved profile'}))
    expect(await screen.findByRole('button',{name:'Add parent asset details'})).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Save profile'}));await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Profile saved locally'))
    const saved=(await householdRepository.load())!;expect(saved.calculation!.parentAssets).toBeUndefined();expect(calculateProfileAid(saved).status).toBe('calculated')
  })
  it('D2 saves unanswered fields as unknown; zero and no require input, with no fetch/XHR/logs',async()=>{
    const fetch=vi.spyOn(globalThis,'fetch'),xhr=vi.spyOn(XMLHttpRequest.prototype,'open'),log=vi.spyOn(console,'log')
    const user=userEvent.setup();render(<HouseholdProfileForm/>);await user.type(screen.getByLabelText('Student name'),'Synthetic student');await user.type(screen.getByLabelText('Household label'),'Synthetic household');await user.selectOptions(screen.getByLabelText('State or location'),'AK');await user.click(screen.getByRole('button',{name:'Add financial details'}))
    expect(screen.getAllByLabelText('Adjusted gross income')[0]).toHaveValue(null);expect(screen.getByLabelText('Single-parent household')).toHaveValue('')
    await user.type(screen.getAllByLabelText('Adjusted gross income')[0],'0');await user.selectOptions(screen.getByLabelText('Single-parent household'),'false');await user.click(screen.getByRole('button',{name:'Save profile'}));await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Profile saved locally'))
    const saved=(await householdRepository.load())!;expect(saved).toMatchObject({state:'AK',calculation:{parentIncome:{agi:0,incomeTaxPaid:null},parentSingleParent:false,qualifyingParentNonfiler:null}});expect(calculateProfileAid(saved).status).toBe('incomplete')
    expect(fetch).not.toHaveBeenCalled();expect(xhr).not.toHaveBeenCalled();expect(log).not.toHaveBeenCalled()
  })
})
