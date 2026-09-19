import { useEffect,useState } from 'react'
import metadata from '../../data/scorecard/production-metadata.json'
import { scorecardSnapshotSchema,type ScorecardSnapshot } from './schema'

export const productionMetadata=metadata
let cached:Promise<ScorecardSnapshot>|undefined
export function loadProductionSnapshot(){
  if(!cached)cached=(async()=>{
    const response=await fetch(`/scorecard/${metadata.snapshotVersion}.json`,{credentials:'omit',referrerPolicy:'no-referrer'})
    if(!response.ok)throw new Error('School snapshot unavailable')
    const raw=await response.json()
    const snapshot=scorecardSnapshotSchema.parse(raw)
    if(snapshot.metadata.snapshotVersion!==metadata.snapshotVersion||snapshot.metadata.recordCount!==metadata.recordCount)throw new Error('Snapshot version mismatch')
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(raw.records)))
    const checksum=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
    if(checksum!==metadata.checksumSha256)throw new Error('Snapshot checksum mismatch')
    return snapshot
  })().catch(()=>{cached=undefined;throw new Error('School data could not be loaded or validated. Reload to retry. Your saved data was not changed.')})
  return cached
}
export function useProductionSnapshot(){
  const [snapshot,setSnapshot]=useState<ScorecardSnapshot>(),[error,setError]=useState<Error>()
  useEffect(()=>{let active=true;loadProductionSnapshot().then(value=>{if(active)setSnapshot(value)},()=>{if(active)setError(new Error('School data could not be loaded or validated. Reload to retry.'))});return()=>{active=false}},[])
  if(error)throw error
  return snapshot
}
