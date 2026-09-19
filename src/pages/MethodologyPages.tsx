import { PageShell } from '../components/PageShell'
import { baseline, methodologySections, policyEvents, schoolMetadata, sources } from '../data/methodology'

function SourceCallout({ id }: { id: string }) {
  const source = sources.find(item => item.id === id)!
  return <li className="rounded-lg border border-line bg-moss-100 p-3 text-sm leading-6">
    <p>{source.agency}</p>
    <a className="font-bold text-moss-700 underline" href={source.url}>{source.title}</a>
    <p>{source.date}</p>
    <p>Contract v{baseline.contractVersion} · source inventory verified {baseline.asOf}</p>
  </li>
}

export function MethodologyPage() {
  return <PageShell eyebrow="Methodology" title="How your estimates are calculated." intro="Plain-language explanations of the implemented methods, followed by technical details and dated primary sources. These are planning estimates, not aid offers or servicer quotes.">
    <p className="rounded-lg border border-line bg-gold-100 p-4 text-sm">Frozen calculation contract v{baseline.contractVersion} · verified <time dateTime={baseline.asOf}>{baseline.asOf}</time>. Policy status is not live. New rules require a reviewed version update.</p>
    <nav className="card mt-6 p-6" aria-label="Methodology sections"><h2 className="font-serif text-2xl font-bold">Find a calculation</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{methodologySections.map(section => <li key={section.id}><a className="text-moss-700 underline" href={`#${section.id}`}>{section.title}</a></li>)}</ul></nav>
    <div className="mt-6 grid gap-6">{methodologySections.map(section => <section className="card scroll-mt-24 p-6 sm:p-8" id={section.id} key={section.id} aria-labelledby={`${section.id}-heading`}>
      <h2 className="font-serif text-2xl font-bold" id={`${section.id}-heading`}>{section.title}</h2>
      <p className="mt-4 max-w-3xl leading-7">{section.summary}</p>
      <details className="mt-4 max-w-3xl"><summary className="cursor-pointer font-bold text-moss-700">Calculation details and limitations</summary><div className="mt-3 space-y-4 leading-7">{section.details.map(detail => <p key={detail}>{detail}</p>)}</div></details>
      {section.sources.length ? <><h3 className="mt-5 font-bold">Primary sources and versions</h3><ul className="mt-3 grid gap-3 sm:grid-cols-2">{section.sources.map(id => <SourceCallout key={id} id={id}/>)}</ul></> : <p className="mt-4 text-sm">Implementation reference: local storage schema v4 and frozen contract §§0, 9, 11. This is an app architecture statement, not a federal formula.</p>}
      {section.id === 'scorecard' ? <p className="mt-4 break-all text-xs">Snapshot SHA-256: {schoolMetadata.checksumSha256}</p> : null}
    </section>)}</div>
  </PageShell>
}

export function PolicyChangesPage() {
  return <PageShell eyebrow="Policy changes" title="Dated rules, clearly scoped." intro="This log records the policy history used by the project—not a live legal update service. Effective dates, publication dates, transitions, and litigation are distinguished below.">
    <p className="rounded-lg border border-line bg-gold-100 p-4">Policy baseline as of <time dateTime={baseline.asOf}>{baseline.asOf}</time> · contract v{baseline.contractVersion}. “Effective” refers to the recorded baseline and the stated award year or cohort.</p>
    <ol className="mt-6 grid gap-5" aria-label="Policy timeline">{policyEvents.map(event => <li key={`${event.date}-${event.source}`} className="card p-6 sm:p-8">
      <p className="text-sm font-bold"><time dateTime={event.date}>{event.date}</time> · <span className={event.status === 'Unresolved / litigated' ? 'rounded bg-gold-100 px-2 py-1' : ''}>{event.status}</span></p>
      <h2 className="mt-3 font-serif text-2xl font-bold">{event.title}</h2><p className="mt-3 max-w-3xl leading-7">{event.text}</p>
      <ul className="mt-4"><SourceCallout id={event.source}/></ul>
    </li>)}</ol>
    <p className="mt-6 text-sm">Phase 7 reconciles the canonical repayment regression fixtures with the existing Phase 6 tests. It does not revise federal policy, calculation behavior, or the frozen contract version.</p>
  </PageShell>
}
