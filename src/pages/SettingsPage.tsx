import { useState,type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageShell,PlaceholderCard } from '../components/PageShell'
import { backupService,parseNavigatorBackup } from '../lib/storage/backup'
import { navigatorDatabase } from '../lib/storage/database'
import { householdRepository } from '../lib/storage/repositories'
import { STORAGE_METADATA } from '../lib/storage/schema'

const emptySummary={profiles:0,savedSchools:0,loanScenarios:0,projectionAssumptions:0,total:0}

export function SettingsPage(){
  const local=useLiveQuery(async()=>({profile:await navigatorDatabase.profiles.get('current-household'),summary:await backupService.summarize()}),[],null)
  const [status,setStatus]=useState('')
  const profile=local?.profile,summary=local?.summary??emptySummary
  const deleteAll=async()=>{if(!window.confirm('Delete all College Cost Navigator data stored in this browser? This cannot be undone.'))return;await householdRepository.deleteAll();setStatus('All navigator data was deleted from this browser.')}
  const exportBackup=async()=>{try{const backup=await backupService.create(),blob=new Blob([`${JSON.stringify(backup,null,2)}\n`],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`college-cost-navigator-backup-${backup.exportedAt.slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);setStatus('Backup downloaded. Keep it private: it contains the financial values you entered.')}catch{setStatus('The local backup could not be created.')}}
  const restoreBackup=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;try{const parsed=parseNavigatorBackup(JSON.parse(await file.text()));if(!window.confirm('Replace all College Cost Navigator data in this browser with this validated backup?'))return;const restored=await backupService.restore(parsed);setStatus(`Backup restored: ${restored.profiles} profile, ${restored.savedSchools} saved schools, and ${restored.loanScenarios} loan scenarios.`)}catch{setStatus('Backup not restored. Choose a valid, compatible College Cost Navigator backup v4 file.')}}
  return <PageShell eyebrow="Settings" title="Control your local planning data." intro="Household, school, and loan scenarios are stored only in this browser. Export a private copy or remove everything at any time.">
    <div className="grid max-w-5xl gap-5 md:grid-cols-2"><PlaceholderCard title="Local storage"><p>{profile?`A profile for ${profile.studentName} is saved on this device.`:'No household profile is saved on this device.'}</p><dl className="mt-4 grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-moss-100 p-4 text-sm"><dt>Household profiles</dt><dd className="font-bold">{summary.profiles}</dd><dt>Saved schools</dt><dd className="font-bold">{summary.savedSchools}</dd><dt>Loan scenarios</dt><dd className="font-bold">{summary.loanScenarios}</dd></dl><button type="button" className="mt-5 rounded-lg border border-red-700 bg-white px-4 py-3 font-bold text-red-800 hover:bg-red-50 disabled:opacity-50" disabled={summary.total===0} onClick={deleteAll}>Delete all local data</button></PlaceholderCard>
      <PlaceholderCard title="Versioned backup"><dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt>Database schema</dt><dd className="font-bold">v{STORAGE_METADATA.databaseVersion}</dd><dt>Backup format</dt><dd className="font-bold">v{STORAGE_METADATA.backupFormatVersion}</dd></dl><p className="mt-4 text-sm">Backup files are unencrypted JSON and may contain sensitive financial values. Store them somewhere private; they are never uploaded by this app.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" className="button-primary" disabled={summary.total===0} onClick={exportBackup}>Download backup</button><label className="button-secondary cursor-pointer">Restore backup<input className="sr-only" type="file" accept="application/json,.json" aria-label="Restore backup file" onChange={restoreBackup}/></label></div></PlaceholderCard></div>
    <p className="mt-4 min-h-6 text-sm font-bold text-moss-700" role="status">{status}</p>
  </PageShell>
}
