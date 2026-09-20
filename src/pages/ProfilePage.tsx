import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GuidedProfileWizard } from '../components/GuidedProfileWizard'
import { HouseholdProfileForm } from '../components/HouseholdProfileForm'
import { NextStepActions } from '../components/Explainability'
import { PageShell } from '../components/PageShell'
import { FICTIONAL_DEMO_PROFILE } from '../lib/storage/demoProfile'

export function ProfilePage() {
  const [params]=useSearchParams(),[mode,setMode]=useState<'guided'|'full'>(params.get('mode')==='guided'?'guided':'full')
  const demo=params.get('demo')==='1'
  return <PageShell eyebrow="Your household" title="Keep a planning profile on this device." intro="Choose guided setup or the full form. Both write to the same browser-local household profile.">
    <div className="mb-6 flex flex-wrap gap-3" role="group" aria-label="Profile setup choice"><button type="button" className={mode==='guided'?'button-primary':'button-secondary'} aria-pressed={mode==='guided'} onClick={()=>setMode('guided')}>Guide me through it</button><button type="button" className={mode==='full'?'button-primary':'button-secondary'} aria-pressed={mode==='full'} onClick={()=>setMode('full')}>Use full form</button></div>
    {mode==='guided'?<GuidedProfileWizard initialProfile={demo?structuredClone(FICTIONAL_DEMO_PROFILE):undefined}/>:<div className="grid max-w-5xl gap-5 lg:grid-cols-[1.4fr_.6fr]"><HouseholdProfileForm /><section className="rounded-2xl border border-gold-500 bg-gold-100 p-6"><p className="eyebrow">Unsupported in v1.1</p><h2 className="mt-3 font-serif text-2xl font-bold">Independent students</h2><p className="mt-3 leading-7 text-ink-700">Formula B and Formula C are not available. The navigator will not apply dependent-student Formula A or produce an estimate.</p><p className="mt-4 text-sm font-bold">Status: Unsupported—not calculated</p></section></div>}
    <div className="max-w-5xl"><NextStepActions actions={[{to:'/app/aid-estimate',label:'Estimate federal aid'}]}/></div>
  </PageShell>
}
