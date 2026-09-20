import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter,Route,Routes } from 'react-router-dom'
import { afterEach,describe,expect,it,vi } from 'vitest'
import { calculateProfileAid } from '../lib/calculations'
import { FICTIONAL_DEMO_PROFILE } from '../lib/storage/demoProfile'
import { householdRepository } from '../lib/storage/repositories'
import { householdProfileSchema } from '../lib/storage/schema'
import { evaluateProfileDraft } from '../lib/profileDraft'
import { GuidedProfileWizard } from './GuidedProfileWizard'

afterEach(()=>vi.restoreAllMocks())
const renderWizard=(initialProfile=undefined as typeof FICTIONAL_DEMO_PROFILE|undefined)=>render(<MemoryRouter initialEntries={['/profile']}><Routes><Route path="/profile" element={<GuidedProfileWizard initialProfile={initialProfile}/>} /><Route path="/app/aid-estimate" element={<p>Aid route</p>}/></Routes></MemoryRouter>)

describe('guided household profile wizard',()=>{
  it('preserves values across back and next',async()=>{const user=userEvent.setup();renderWizard();await user.type(screen.getByLabelText('Student name'),'Avery');await user.type(screen.getByLabelText('Household label'),'Avery household');await user.selectOptions(screen.getByLabelText('State or location'),'OH');await user.click(screen.getByRole('button',{name:/Next: Parent/}));await user.click(screen.getByRole('button',{name:'Back'}));expect(screen.getByLabelText('Student name')).toHaveValue('Avery');expect(screen.getByLabelText('Household label')).toHaveValue('Avery household')})
  it('keeps unknown and confirmed zero distinct',async()=>{const user=userEvent.setup();renderWizard();await user.click(screen.getByRole('button',{name:/Next: Parent/}));await user.selectOptions(screen.getByLabelText('Parents’ living arrangement'),'married_together');await user.click(screen.getByRole('button',{name:/Next: Parent income/}));const agi=screen.getByLabelText('Adjusted gross income (AGI)');expect(agi).toHaveValue(null);await user.type(agi,'0');expect(agi).toHaveValue(0);await user.click(screen.getByRole('button',{name:'Back'}));await user.click(screen.getByRole('button',{name:/Next: Parent income/}));expect(screen.getByLabelText('Adjusted gross income (AGI)')).toHaveValue(0)})
  it('does not allow an incomplete wizard to calculate',async()=>{const user=userEvent.setup();renderWizard();for(let index=0;index<7;index++)await user.click(screen.getByRole('button',{name:/^Next:/}));expect(screen.getByRole('button',{name:'Save profile and estimate federal aid'})).toBeDisabled();expect(screen.getByText('Incomplete',{exact:true})).toBeVisible()})
  it('saves the canonical Rivera profile and preserves its deterministic result',async()=>{const user=userEvent.setup(),save=vi.spyOn(householdRepository,'save').mockResolvedValue(householdProfileSchema.parse({...structuredClone(FICTIONAL_DEMO_PROFILE),id:'current-household',schemaVersion:3,updatedAt:'2026-09-19T00:00:00.000Z'}));renderWizard(FICTIONAL_DEMO_PROFILE);await user.click(screen.getByRole('button',{name:'Save profile and estimate federal aid'}));expect(save).toHaveBeenCalledTimes(1);const input=save.mock.calls[0][0],stored=householdProfileSchema.parse({...structuredClone(input),id:'current-household',schemaVersion:3,updatedAt:'2026-09-19T00:00:00.000Z'});expect(input).toMatchObject(FICTIONAL_DEMO_PROFILE);expect(calculateProfileAid(stored)).toMatchObject({status:'calculated',sai:{sai:2069},pell:{scheduledAward:5325}});expect(await screen.findByText('Aid route')).toBeVisible()})
  it('uses the same canonical profile and calculator as the full form',()=>{const stored=householdProfileSchema.parse({...structuredClone(FICTIONAL_DEMO_PROFILE),id:'current-household',schemaVersion:3,updatedAt:'2026-09-19T00:00:00.000Z'});expect(evaluateProfileDraft(FICTIONAL_DEMO_PROFILE)).toEqual(calculateProfileAid(stored))})
})
