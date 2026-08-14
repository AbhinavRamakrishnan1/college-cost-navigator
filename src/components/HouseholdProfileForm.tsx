import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FICTIONAL_DEMO_PROFILE } from '../lib/storage/demoProfile'
import { navigatorDatabase } from '../lib/storage/database'
import { householdRepository } from '../lib/storage/repositories'
import type { HouseholdProfileInput } from '../lib/storage/schema'

const EMPTY_PROFILE: HouseholdProfileInput = { studentName: '', householdName: '', dependencyStatus: 'dependent', awardYear: '2026-27', familySize: 2, state: '', isFictionalDemo: false }

export function HouseholdProfileForm() {
  const savedProfile = useLiveQuery(() => navigatorDatabase.profiles.get('current-household'))
  const [draft, setDraft] = useState<HouseholdProfileInput>(EMPTY_PROFILE)
  const [status, setStatus] = useState('No profile loaded.')
  const setField = <K extends keyof HouseholdProfileInput>(key: K, value: HouseholdProfileInput[K]) => setDraft((current) => ({ ...current, [key]: value, isFictionalDemo: false }))

  const loadDemo = () => { setDraft(FICTIONAL_DEMO_PROFILE); setStatus('Fictional demo loaded. Choose Save profile to keep it in this browser.') }
  const loadSaved = async () => {
    const profile = await householdRepository.load()
    if (!profile) { setStatus('No saved profile found in this browser.'); return }
    setDraft({ studentName: profile.studentName, householdName: profile.householdName, dependencyStatus: profile.dependencyStatus, awardYear: profile.awardYear, familySize: profile.familySize, state: profile.state, isFictionalDemo: profile.isFictionalDemo })
    setStatus('Saved profile loaded from this browser.')
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    try { await householdRepository.save(draft); setStatus('Profile saved locally in this browser.') }
    catch { setStatus('Check the highlighted fields before saving.') }
  }

  return <section className="card p-6 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Local household profile</p><h2 className="mt-2 font-serif text-2xl font-bold">Dependent student profile</h2></div>{savedProfile ? <span className="rounded-full bg-moss-100 px-3 py-1 text-xs font-bold text-moss-700">Saved locally</span> : null}</div>
    <p className="mt-3 text-sm leading-6 text-ink-700">Stored only in IndexedDB on this device. Nothing in this form is sent over the network.</p>
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" className="button-secondary" onClick={loadDemo}>Load fictional demo</button><button type="button" className="button-secondary" onClick={loadSaved}>Load saved profile</button></div>
    <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={save}>
      <label className="grid gap-2 text-sm font-bold">Student name<input required maxLength={80} value={draft.studentName} onChange={(event) => setField('studentName', event.target.value)} className="rounded-lg border border-line bg-white px-3 py-2.5 font-normal" /></label>
      <label className="grid gap-2 text-sm font-bold">Household label<input required maxLength={80} value={draft.householdName} onChange={(event) => setField('householdName', event.target.value)} className="rounded-lg border border-line bg-white px-3 py-2.5 font-normal" /></label>
      <label className="grid gap-2 text-sm font-bold">State or location<input required maxLength={40} value={draft.state} onChange={(event) => setField('state', event.target.value)} className="rounded-lg border border-line bg-white px-3 py-2.5 font-normal" /></label>
      <label className="grid gap-2 text-sm font-bold">Family size<input required type="number" min={2} max={20} value={draft.familySize} onChange={(event) => setField('familySize', event.target.valueAsNumber)} className="rounded-lg border border-line bg-white px-3 py-2.5 font-normal" /></label>
      <div className="rounded-lg bg-moss-100 p-4 text-sm"><span className="block text-ink-700">Student type</span><strong>Dependent · Formula A path</strong></div>
      <div className="rounded-lg bg-moss-100 p-4 text-sm"><span className="block text-ink-700">Award year</span><strong>2026–27</strong></div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-4"><button type="submit" className="button-primary">Save profile</button><p role="status" className="text-sm text-ink-700">{status}</p></div>
    </form>
  </section>
}
