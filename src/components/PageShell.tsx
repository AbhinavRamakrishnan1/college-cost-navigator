import type { ReactNode } from 'react'

export function PageShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children?: ReactNode }) {
  return <div className="page-wrap py-14 sm:py-20"><p className="eyebrow">{eyebrow}</p><h1 className="page-title mt-4 max-w-4xl">{title}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-ink-700">{intro}</p>{children ? <div className="mt-10">{children}</div> : null}</div>
}

export function PlaceholderCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card max-w-3xl p-6 sm:p-8"><h2 className="font-serif text-2xl font-bold tracking-tight">{title}</h2><div className="mt-3 leading-7 text-ink-700">{children}</div></section>
}
