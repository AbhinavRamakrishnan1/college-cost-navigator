import { useLiveQuery } from 'dexie-react-hooks'
import { PageShell, PlaceholderCard } from '../components/PageShell'
import { navigatorDatabase } from '../lib/storage/database'
import { householdRepository } from '../lib/storage/repositories'
import { STORAGE_METADATA } from '../lib/storage/schema'

function AppPlaceholder({ eyebrow, title, intro, cardTitle, message }: { eyebrow: string; title: string; intro: string; cardTitle: string; message: string }) { return <PageShell eyebrow={eyebrow} title={title} intro={intro}><PlaceholderCard title={cardTitle}><p>{message}</p><p className="mt-4 rounded-lg bg-moss-100 p-4 text-sm font-semibold text-moss-700">Phase 2 placeholder · no calculation</p></PlaceholderCard></PageShell> }
export function AidEstimatePage() { return <AppPlaceholder eyebrow="Aid estimate" title="Estimate aid with the policy year in view." intro="The fictional dependent-student path is selected. Calculation engines are intentionally not part of Phase 1." cardTitle="Estimate not available yet" message="SAI and Pell calculations are not implemented. Independent students receive an unsupported state rather than Formula A." /> }
export function SchoolsPage() { return <AppPlaceholder eyebrow="Schools" title="Build a school list around the questions that matter." intro="Search and College Scorecard ingestion are reserved for a later phase." cardTitle="No schools added" message="The fictional household has no school records. This page currently demonstrates the future workspace." /> }
export function ComparePage() { return <AppPlaceholder eyebrow="Compare" title="See choices side by side, without false precision." intro="Future comparisons will separate published cost, estimated aid, and assumptions." cardTitle="Nothing to compare yet" message="Add-school and net-price calculations are outside the Phase 1 scope." /> }
export function RepaymentPage() { return <AppPlaceholder eyebrow="Repayment" title="Understand borrowing before it becomes a bill." intro="Repayment plans and projections are not calculated in Phase 1." cardTitle="Loan types stay distinct" message="The policy model distinguishes Parent PLUS from Grad/Professional PLUS. RAP, IBR, and Tiered Standard calculations are not implemented." /> }
export function SettingsPage() {
  const profile = useLiveQuery(() => navigatorDatabase.profiles.get('current-household'))
  const deleteAll = async () => {
    if (!window.confirm('Delete all College Cost Navigator data stored in this browser? This cannot be undone.')) return
    await householdRepository.deleteAll()
  }
  return <PageShell eyebrow="Settings" title="Control your local planning data." intro="Your household profile is stored only in this browser. You can remove it at any time."><div className="grid max-w-4xl gap-5 md:grid-cols-2"><PlaceholderCard title="Local storage"><p>{profile ? `A profile for ${profile.studentName} is saved on this device.` : 'No household profile is saved on this device.'}</p><button type="button" className="mt-5 rounded-lg border border-red-700 bg-white px-4 py-3 font-bold text-red-800 hover:bg-red-50 disabled:opacity-50" disabled={!profile} onClick={deleteAll}>Delete all local data</button></PlaceholderCard><PlaceholderCard title="Backup compatibility"><dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt>Database schema</dt><dd className="font-bold">v{STORAGE_METADATA.databaseVersion}</dd><dt>Backup format</dt><dd className="font-bold">v{STORAGE_METADATA.backupFormatVersion}</dd></dl><p className="mt-4 text-sm">Export and restore are not implemented in Phase 2; metadata is reserved for a future compatible format.</p></PlaceholderCard></div></PageShell>
}
