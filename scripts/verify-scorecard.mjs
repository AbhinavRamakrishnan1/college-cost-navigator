import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { scorecardSnapshotSchema } from '../src/lib/scorecard/schema.ts'
const metadata=JSON.parse(await readFile('src/data/scorecard/production-metadata.json','utf8'))
const raw=JSON.parse(await readFile(`public/scorecard/${metadata.snapshotVersion}.json`,'utf8'))
const parsed=scorecardSnapshotSchema.parse(raw)
if(parsed.metadata.datasetKind!=='full_snapshot'||parsed.records.length<1000)throw new Error('National coverage release gate failed')
if(new Set(parsed.records.map(row=>row.unitId)).size!==parsed.records.length)throw new Error('Duplicate UNITID')
const checksum=createHash('sha256').update(JSON.stringify(raw.records)).digest('hex')
if(checksum!==metadata.checksumSha256||JSON.stringify(raw.metadata)!==JSON.stringify(metadata))throw new Error('Snapshot integrity mismatch')
console.log(`PASS: ${parsed.records.length} records; SHA-256 ${checksum}`)
