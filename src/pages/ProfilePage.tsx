import { HouseholdProfileForm } from '../components/HouseholdProfileForm'
import { PageShell } from '../components/PageShell'

export function ProfilePage() {
  return <PageShell eyebrow="Your household" title="Keep a planning profile on this device." intro="Enter a supported dependent-student household or load the clearly fictional Rivera demo. Your profile stays in this browser."><div className="grid max-w-5xl gap-5 lg:grid-cols-[1.4fr_.6fr]"><HouseholdProfileForm /><section className="rounded-2xl border border-gold-500 bg-gold-100 p-6"><p className="eyebrow">Unsupported in v1</p><h2 className="mt-3 font-serif text-2xl font-bold">Independent students</h2><p className="mt-3 leading-7 text-ink-700">Formula B and Formula C are not available. The navigator will not apply dependent-student Formula A or produce an estimate.</p><p className="mt-4 text-sm font-bold">Status: Unsupported—not calculated</p></section></div></PageShell>
}
