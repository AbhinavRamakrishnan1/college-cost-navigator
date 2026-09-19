import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { PellCalculationTrace,SaiCalculationTrace } from '../components/AidCalculationTrace'
import { CalculationTrace,InlineDefinition,NextStepActions,PolicyVersionBadge,ResultDisclosure } from '../components/Explainability'
import { PageShell,PlaceholderCard } from '../components/PageShell'
import { calculateProfileAid } from '../lib/calculations'
import { householdRepository } from '../lib/storage/repositories'

export function AidEstimatePage(){
  const profile=useLiveQuery(()=>householdRepository.load(),[],null),loading=profile===null
  const result=profile?calculateProfileAid(profile):undefined
  return <PageShell eyebrow="Aid estimate" title="Your 2026–27 aid estimate" intro="Understand the federal estimate, the calculation path, and what these numbers do—and do not—mean.">
    <div className="max-w-4xl"><PolicyVersionBadge kind="aid"/></div>
    <div className="mt-5 grid max-w-4xl gap-5 md:grid-cols-2">
      <PlaceholderCard title="Student Aid Index">
        {loading?<p role="status">Checking this browser for a household profile…</p>:null}
        {!loading&&!profile?<><p className="font-bold">Incomplete: household profile required</p><p className="mt-3">Save a dependent-student profile before requesting an estimate.</p><Link className="button-primary mt-5" to="/profile">Create profile</Link></>:null}
        {result?.status==='incomplete'?<><p className="font-bold">Incomplete: financial inputs required</p><p className="mt-3">This profile does not contain every fact required for an exact federal calculation.</p><p className="mt-3 rounded-lg bg-gold-100 p-4 text-sm">No SAI is shown because the app never guesses missing financial values.</p><Link className="button-primary mt-5" to="/profile">Complete profile</Link></>:null}
        {result?.status==='unsupported'?<><p className="font-bold">Unsupported dependency status</p><p className="mt-3">V1.1 Phase 1 supports dependent students under Formula A only. Formula B and Formula C are not approximated.</p></>:null}
        {result?.status==='calculated'?<><div className="text-sm text-ink-700"><InlineDefinition term="Calculated Student Aid Index (SAI)" learnMore="/methodology#sai">A number used in federal student-aid eligibility calculations. It can be negative.</InlineDefinition></div><p className="mt-2 font-serif text-5xl font-bold" data-testid="calculated-sai">{result.sai.sai.toLocaleString()}</p><p className="mt-4 font-bold">SAI is an eligibility index. It is not a bill and it is not necessarily what your family will pay.</p></>:null}
      </PlaceholderCard>
      <PlaceholderCard title="Federal Pell Grant">
        <div><InlineDefinition term="Pell Grant" learnMore="/methodology#pell">Federal grant aid for eligible undergraduate students. A grant generally does not need to be repaid.</InlineDefinition></div>
        {!result||result.status==='incomplete'?<p className="mt-3">Incomplete until a supported SAI and Pell cost of attendance are available. No Pell path is guessed.</p>:null}
        {result?.status==='unsupported'?<p className="mt-3">No Pell estimate is calculated because dependent-student Formula A is not applicable.</p>:null}
        {result?.status==='calculated'&&result.pell.status==='eligible'?<><p className="mt-3 text-sm text-ink-700">{result.pell.label}</p><p className="mt-2 font-serif text-5xl font-bold" data-testid="pell-award">${result.pell.scheduledAward.toLocaleString()}</p><p className="mt-3">Based on the information you entered, the estimated 2026–27 Federal Pell Grant Scheduled Award is <strong>${result.pell.scheduledAward.toLocaleString()}</strong>.</p><div className="mt-2 text-sm"><InlineDefinition term="Scheduled Award" learnMore="/methodology#pell">The annual award before enrollment intensity and other disbursement factors are applied.</InlineDefinition></div><p className="mt-3 capitalize">{result.pell.eligibility} Pell eligibility path</p></>:null}
        {result?.status==='calculated'&&result.pell.status==='ineligible'?<p className="mt-3 font-bold">Not eligible under the modeled Pell paths.</p>:null}
        {result?.status==='calculated'&&result.pell.status==='unsupported'?<p className="mt-3 font-bold">Special-rule verification is required. No ordinary ineligibility determination is shown.</p>:null}
        <p className="mt-4 text-sm">This is an estimate. The school and federal aid process determine actual eligibility. Enrollment intensity and other award-year factors can affect disbursement.</p>
      </PlaceholderCard>
    </div>
    <div className="max-w-4xl">
      {result?.status==='calculated'?<><SaiCalculationTrace result={result.sai}/><PellCalculationTrace result={result.pell}/></>:<CalculationTrace title="Show how we estimated Pell" testId="pell-trace"><p className="font-bold">{result?.status==='unsupported'?'Unsupported calculation scope':'Incomplete data'}</p><p className="mt-2 text-sm">{result?.status==='unsupported'?'No Pell path is evaluated because Formula B and Formula C are outside the current scope.':'A supported SAI and required Pell inputs are needed before the app can identify a Maximum, Calculated, Minimum, ineligible, or special-rule verification path.'}</p></CalculationTrace>}
      <ResultDisclosure><p className="font-bold">This is a federal aid estimate, not your complete financial aid package.</p><p className="mt-2">It does not include state grants, school or institutional grants, private scholarships, or other school-specific financial aid. Your state, college, or outside organizations may provide additional grants or scholarships.</p></ResultDisclosure>
      <div className="mt-5 rounded-lg border border-line bg-white p-5 text-sm"><p className="font-bold">Methodology</p><p className="mt-2">Formula A supports dependent students only. Calculations use the frozen 2026–27 contract, the 2026–27 FSA SAI and Pell Guide, and 2024 HHS poverty guidelines.</p><div className="mt-2"><InlineDefinition term="Cost of Attendance (COA)" learnMore="/methodology#pell">A school-defined budget used for aid administration. The Pell-specific COA can limit a Scheduled Award.</InlineDefinition></div></div>
      <NextStepActions actions={[{to:'/app/schools',label:'Search colleges'},{to:'/methodology#sai',label:'Review methodology'}]}/>
    </div>
  </PageShell>
}
