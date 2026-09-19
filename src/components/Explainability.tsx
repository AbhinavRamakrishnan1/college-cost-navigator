import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { policyContexts } from '../data/methodology'

export function InlineDefinition({term,children,learnMore}:{term:string;children:ReactNode;learnMore?:string}){
  return <details className="inline-definition"><summary aria-label={`About ${term}`}>{term}<span aria-hidden="true">?</span></summary><div><p>{children}</p>{learnMore?<Link to={learnMore}>Learn more</Link>:null}</div></details>
}

export function ExplanationRow({label,value,explanation}:{label:string;value:string;explanation?:string}){
  return <div className="grid gap-1 border-b border-line py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6"><dt className="font-bold">{label}{explanation?<span className="mt-1 block text-sm font-normal leading-5 text-ink-700">{explanation}</span>:null}</dt><dd className="font-mono font-bold tabular-nums sm:text-right">{value}</dd></div>
}

export function CalculationTrace({title,testId,children}:{title:string;testId:string;children:ReactNode}){
  return <details className="card mt-5" data-testid={testId}><summary className="cursor-pointer list-none px-5 py-4 font-bold text-moss-700 marker:hidden sm:px-6"><span className="flex min-h-6 items-center justify-between gap-4">{title}<span aria-hidden="true" className="text-xl">＋</span></span></summary><div className="border-t border-line px-5 py-5 sm:px-6">{children}</div></details>
}

export function ResultDisclosure({children}:{children:ReactNode}){
  return <aside className="mt-5 rounded-lg border border-line bg-gold-100 p-5 text-sm leading-6" aria-label="Important estimate context">{children}</aside>
}

export function NextStepActions({title='What next?',actions}:{title?:string;actions:Array<{to:string;label:string;description?:string}>}){
  return <nav className="card mt-8 p-5 sm:p-6" aria-label={title}><h2 className="font-serif text-2xl font-bold">{title}</h2><div className="mt-4 flex flex-wrap gap-3">{actions.map(action=><Link key={action.to+action.label} className="button-secondary" to={action.to} title={action.description}>{action.label}</Link>)}</div></nav>
}

export function PolicyVersionBadge({kind}:{kind:keyof typeof policyContexts}){
  const context=policyContexts[kind]
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-moss-100 px-4 py-3 text-sm"><strong>{context.label}</strong><span>Last verified {context.verified}</span><Link className="font-bold text-moss-700 underline" to={context.methodology}>Methodology</Link><Link className="font-bold text-moss-700 underline" to="/policy-changes">Policy changes</Link></div>
}
