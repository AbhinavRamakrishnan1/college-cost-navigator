import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { PageShell, PlaceholderCard } from '../components/PageShell'
import { navigatorDatabase } from '../lib/storage/database'
import { householdRepository } from '../lib/storage/repositories'
import { STORAGE_METADATA } from '../lib/storage/schema'
import { calculateProfileAid } from '../lib/calculations'

function AppPlaceholder({ eyebrow, title, intro, cardTitle, message }: { eyebrow: string; title: string; intro: string; cardTitle: string; message: string }) { return <PageShell eyebrow={eyebrow} title={title} intro={intro}><PlaceholderCard title={cardTitle}><p>{message}</p><p className="mt-4 rounded-lg bg-moss-100 p-4 text-sm font-semibold text-moss-700">Phase 2 placeholder · no calculation</p></PlaceholderCard></PageShell> }
export function AidEstimatePage() {
  const profile = useLiveQuery(() => navigatorDatabase.profiles.get('current-household'), [], null)
  const loading = profile === null
  const result = profile ? calculateProfileAid(profile) : undefined
  return <PageShell eyebrow="Aid estimate" title="Your 2026–27 aid estimate" intro="The Student Aid Index (SAI) is an eligibility index—not a bill or the amount your family will pay.">
    <div className="grid max-w-4xl gap-5 md:grid-cols-2">
      <PlaceholderCard title="SAI calculation">
        {loading ? <p role="status">Checking this browser for a household profile…</p> : null}
        {!loading && !profile ? <><p className="font-bold">Incomplete: household profile required</p><p className="mt-3">Save a dependent-student profile before requesting an estimate.</p><Link className="button-primary mt-5" to="/profile">Create profile</Link></> : null}
        {result?.status==='incomplete'?<><p className="font-bold">Incomplete: financial inputs required</p><p className="mt-3">This migrated or unfinished profile does not contain every parent/student income, filing, payroll, Pell, and asset-exemption fact required for an exact federal calculation.</p><p className="mt-3 rounded-lg bg-gold-100 p-4 text-sm">No SAI is shown because the app never guesses missing financial values.</p><Link className="button-primary mt-5" to="/profile">Complete profile</Link></>:null}
        {result?.status==='unsupported'?<><p className="font-bold">Unsupported dependency status</p><p className="mt-3">V1 supports dependent students under Formula A only. Formula B and Formula C are not approximated.</p></>:null}
        {result?.status==='calculated'?<><p className="text-sm text-ink-700">Calculated Student Aid Index</p><p className="mt-2 font-serif text-5xl font-bold" data-testid="calculated-sai">{result.sai.sai.toLocaleString()}</p><p className="mt-4">This index combines the federal parent contribution and nonnegative student income and asset contributions. It is not a bill or a price.</p></>:null}
      </PlaceholderCard>
      <PlaceholderCard title="Pell Scheduled Award estimate">
        {!result||result.status==='incomplete'?<p>Incomplete until an SAI and Pell cost of attendance are available. Eligibility can follow the Maximum Pell, Calculated Pell, or Minimum Pell path.</p>:null}
        {result?.status==='unsupported'?<p>No Pell estimate is calculated because dependent-student Formula A is not applicable.</p>:null}
        {result?.status==='calculated'&&result.pell.status==='eligible'?<><p className="text-sm text-ink-700">{result.pell.label}</p><p className="mt-2 font-serif text-5xl font-bold" data-testid="pell-award">${result.pell.scheduledAward.toLocaleString()}</p><p className="mt-3 capitalize">{result.pell.eligibility} Pell eligibility path</p></>:null}
        {result?.status==='calculated'&&result.pell.status==='ineligible'?<p className="font-bold">Not eligible under the modeled Pell paths.</p>:null}
        {result?.status==='calculated'&&result.pell.status==='unsupported'?<p className="font-bold">The statutory special rule may apply and is not modeled. No ineligibility determination is shown.</p>:null}
        <p className="mt-4 text-sm">Actual annual and disbursed Pell may also depend on enrollment intensity, lifetime eligibility used, program eligibility, and other statutory restrictions.</p>
      </PlaceholderCard>
    </div>
    <div className="mt-5 max-w-4xl rounded-lg border border-line bg-white p-5 text-sm">
      <p className="font-bold">Methodology</p><p className="mt-2">Formula A supports dependent students only. Independent-student Formula B/C cases fail closed as unsupported. Calculations use the frozen 2026–27 contract, the 2026–27 FSA SAI and Pell Guide, and 2024 HHS poverty guidelines.</p>
      <Link className="mt-3 inline-block font-bold text-moss-700 underline" to="/methodology">Review methodology and sources</Link>
    </div>
  </PageShell>
}
export function RepaymentPage() { return <AppPlaceholder eyebrow="Repayment" title="Understand borrowing before it becomes a bill." intro="Repayment plans and projections are not calculated in Phase 1." cardTitle="Loan types stay distinct" message="The policy model distinguishes Parent PLUS from Grad/Professional PLUS. RAP, IBR, and Tiered Standard calculations are not implemented." /> }
export function SettingsPage() {
  const profile = useLiveQuery(() => navigatorDatabase.profiles.get('current-household'))
  const deleteAll = async () => {
    if (!window.confirm('Delete all College Cost Navigator data stored in this browser? This cannot be undone.')) return
    await householdRepository.deleteAll()
  }
  return <PageShell eyebrow="Settings" title="Control your local planning data." intro="Your household profile is stored only in this browser. You can remove it at any time."><div className="grid max-w-4xl gap-5 md:grid-cols-2"><PlaceholderCard title="Local storage"><p>{profile ? `A profile for ${profile.studentName} is saved on this device.` : 'No household profile is saved on this device.'}</p><button type="button" className="mt-5 rounded-lg border border-red-700 bg-white px-4 py-3 font-bold text-red-800 hover:bg-red-50 disabled:opacity-50" disabled={!profile} onClick={deleteAll}>Delete all local data</button></PlaceholderCard><PlaceholderCard title="Backup compatibility"><dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt>Database schema</dt><dd className="font-bold">v{STORAGE_METADATA.databaseVersion}</dd><dt>Backup format</dt><dd className="font-bold">v{STORAGE_METADATA.backupFormatVersion}</dd></dl><p className="mt-4 text-sm">Export and restore are not implemented in Phase 2; metadata is reserved for a future compatible format.</p></PlaceholderCard></div></PageShell>
}
