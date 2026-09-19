import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const expected={
  'federal-loan-rates-2026-27.json':'1d44f58fbe8192ad8babe83d0ab03418d9bcbaeacfd78db7b0e74f3ff22aec5b',
  'hhs-poverty-guidelines-2024-pell.json':'93479779354e494a624799bf67f237ed4a7d1186a708e6bac2dd08add21e8b2a',
  'hhs-poverty-guidelines-2026-idr.json':'ae6a0dfec5d68d11a96fb6be812959f3d814712b44cf0279b453b073359ebfff',
  'policy-constants-v1.0.json':'5b5856a820c7637170440ba687bbdf3318a213d01f94c70cd14ba0c78336537c',
  'policy-status-2026-08-07.json':'d09057b1654e3dee1dbb8c868f5769bf41c6b125b155d7f656163bd153b6bb1c',
  'source-manifest-v1.0.json':'97ee5608d68a30dbe32a0c1e6f377014c74695d77d66b4972399a6398126943a',
}
for(const [file,checksum]of Object.entries(expected)){
  const text=(await readFile(`src/data/policy/${file}`,'utf8')).replaceAll('\r\n','\n')
  if(createHash('sha256').update(text).digest('hex')!==checksum)throw new Error(`Frozen policy changed: ${file}`)
}
console.log('PASS: all six frozen policy JSON hashes match (LF-normalized for cross-platform checkouts).')
