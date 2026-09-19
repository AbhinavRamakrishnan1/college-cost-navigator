import { useState,useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

const publicLinks = [
  ['/how-it-works', 'How it works'], ['/methodology', 'Methodology'], ['/policy-changes', 'Policy changes'], ['/privacy', 'Privacy'],
] as const
const appLinks = [
  ['/app/aid-estimate', 'Aid estimate'], ['/app/schools', 'Schools'], ['/app/compare', 'Compare'], ['/app/repayment', 'Repayment'], ['/app/settings', 'Settings'],
] as const

function Mark() {
  return <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-moss-700 text-sm font-black text-white">CC</span>
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const menuButton=useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const close = () => setOpen(false)
  const navClass = ({ isActive }: { isActive: boolean }) => `rounded-md px-3 py-2 text-sm font-semibold no-underline ${isActive ? 'bg-moss-100 text-moss-700' : 'text-ink-700 hover:bg-white hover:text-ink-950'}`

  return (
    <div className="min-h-screen" onKeyDown={event=>{if(event.key==='Escape'&&open){setOpen(false);menuButton.current?.focus()}}}>
      <a href="#main-content" className="fixed left-3 top-3 z-50 -translate-y-24 rounded-md bg-ink-950 px-4 py-2 text-white focus:translate-y-0">Skip to content</a>
      <header className="border-b border-line bg-paper/95 backdrop-blur">
        <div className="page-wrap flex min-h-18 items-center justify-between gap-4">
          <Link to="/" onClick={close} className="flex items-center gap-2.5 text-sm font-extrabold tracking-tight text-ink-950 no-underline"><Mark /><span>College Cost<br className="sm:hidden" /> Navigator</span></Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {publicLinks.map(([to, label]) => <NavLink key={to} to={to} className={navClass}>{label}</NavLink>)}
            <NavLink to="/profile" className="button-primary ml-2">Open navigator</NavLink>
          </nav>
          <button ref={menuButton} type="button" className="rounded-md border border-line bg-white px-3 py-2 text-sm font-bold lg:hidden" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((value) => !value)}>{open ? 'Close' : 'Menu'}</button>
        </div>
        {open ? <nav id="mobile-menu" aria-label="Mobile" className="page-wrap grid gap-1 border-t border-line py-3 lg:hidden">
          {publicLinks.map(([to, label]) => <NavLink key={to} to={to} onClick={close} className={navClass}>{label}</NavLink>)}
          <NavLink to="/profile" onClick={close} className={navClass}>Open navigator</NavLink>
        </nav> : null}
      </header>
      {location.pathname.startsWith('/app/') || location.pathname === '/profile' ? <nav aria-label="Navigator sections" className="border-b border-line bg-white"><div className="page-wrap flex gap-1 overflow-x-auto py-2">{appLinks.map(([to, label]) => <NavLink key={to} to={to} className={navClass}>{label}</NavLink>)}</div></nav> : null}
      <main id="main-content" tabIndex={-1}><Outlet /></main>
      <footer className="mt-20 border-t border-line bg-white py-10">
        <div className="page-wrap grid gap-6 text-sm text-ink-700 md:grid-cols-[1fr_auto]">
          <div><p className="font-bold text-ink-950">College Cost & Aid Navigator</p><p className="mt-2 max-w-xl">Planning guidance, not financial advice. Estimates will always state their policy version and assumptions.</p></div>
          <div className="flex flex-wrap gap-x-5 gap-y-2"><Link to="/privacy">Privacy</Link><Link to="/methodology">Methodology</Link><Link to="/policy-changes">Policy changes</Link></div>
        </div>
      </footer>
    </div>
  )
}
