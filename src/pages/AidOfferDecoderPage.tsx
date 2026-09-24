import { PageShell } from '../components/PageShell'

const terms=[
  ['Cost of Attendance','A school’s published estimate of tuition, fees, housing, food, books, transportation, and other allowed educational costs. It is not necessarily the amount billed.'],
  ['Tuition and fees','Charges for enrollment and mandatory fees. Housing, meals, books, and transportation may be separate.'],
  ['Grants','Aid that generally does not need to be repaid. Confirm the amount, eligibility conditions, and whether it renews.'],
  ['Scholarships','Aid that generally does not need to be repaid. Renewal, enrollment, grade, or other conditions may apply.'],
  ['Federal Pell Grant','Federal grant aid for eligible undergraduate students. This app labels its result a Scheduled Award estimate, not an aid offer.'],
  ['Work-study','An opportunity to earn wages through eligible work. It is not an upfront grant that automatically reduces the bill.'],
  ['Direct Subsidized Loan','Student borrowing for which the federal government generally covers interest during qualifying in-school periods. A loan is not grant aid.'],
  ['Direct Unsubsidized Loan','Student borrowing that accrues interest while the student is in school. A loan is not grant aid.'],
  ['Parent PLUS','Federal borrowing owed by the parent borrower. It is kept separate from the student’s debt in this app.'],
  ['Student Aid Index','An index used in federal student-aid calculations. SAI is not a bill and is not necessarily the amount a family will pay.'],
  ['Net price','Published cost minus grant and scholarship aid in the applicable definition. College Scorecard average net price is a historical average, not your personalized net price or aid offer.'],
  ['Loan origination fee','A fee deducted from the gross loan principal before proceeds reach the school. Gross principal minus the fee equals net proceeds.'],
] as const

export function AidOfferDecoderPage(){return <PageShell eyebrow="Aid offer decoder" title="Read an aid offer without mixing aid and debt." intro="A concise glossary for the terms that commonly appear in school cost and financial-aid materials.">
  <p className="rounded-lg border border-line bg-gold-100 p-4">Use the school’s official offer as the source of truth. Confirm renewable aid, borrowing ownership, and costs directly with the school.</p>
  <dl className="mt-6 grid gap-4 md:grid-cols-2">{terms.map(([term,description])=><div key={term} className="card p-5"><dt className="font-serif text-xl font-bold">{term}</dt><dd className="mt-2 leading-7">{description}</dd></div>)}</dl>
</PageShell>}
