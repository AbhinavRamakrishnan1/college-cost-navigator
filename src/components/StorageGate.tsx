import { useEffect,useState,type ReactNode } from 'react'
import { navigatorDatabase } from '../lib/storage/database'
import { DATABASE_VERSION } from '../lib/storage/schema'

export function StorageGate({children}:{children:ReactNode}){
  const [state,setState]=useState<'loading'|'ready'|'failed'>('loading')
  useEffect(()=>{
    let active=true
    const timeout=setTimeout(()=>{if(active)setState('failed')},8000)
    void navigatorDatabase.open().then(()=>{if(active)setState(navigatorDatabase.backendDB().version===DATABASE_VERSION*10?'ready':'failed')},()=>{if(active)setState('failed')}).finally(()=>clearTimeout(timeout))
    return()=>{active=false;clearTimeout(timeout)}
  },[])
  if(state==='failed')throw new Error('Browser-local storage is unavailable. Enable storage or restore a valid backup.')
  return state==='ready'?children:<p className="page-wrap py-12" role="status">Checking browser-local storage…</p>
}
