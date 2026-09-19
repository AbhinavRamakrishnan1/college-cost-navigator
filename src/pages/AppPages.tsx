import { householdRepository } from '../lib/storage/repositories'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { PageShell, PlaceholderCard } from '../components/PageShell'

import { calculateProfileAid } from '../lib/calculations'

export function AidEstimatePage() {
  const profile = useLiveQuery(() => householdRepository.load(), [], null)
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
        <Link className="text-moss-700 underline" to="/methodology#pell">How is Pell calculated?</Link>
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
      <Link className="mt-3 inline-block font-bold text-moss-700 underline" to="/methodology#sai">Review methodology and sources</Link>
    </div>
  </PageShell>
}
