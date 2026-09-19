import { readdir,readFile } from 'node:fs/promises'
import { join } from 'node:path'
async function* files(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())yield*files(path);else if(/\.(js|ts|tsx|html|css|json)$/.test(path))yield path}}
let scanned=0
for(const root of ['src','dist'])for await(const file of files(root)){
  const text=await readFile(file,'utf8');scanned++
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk_live_[A-Za-z0-9]{20,}/.test(text))throw new Error(`Credential pattern detected in ${file}`)
  if(root==='src'&&!file.includes('.test.')&&/dangerouslySetInnerHTML|console\.(log|debug|info)\s*\(|sendBeacon\s*\(/.test(text))throw new Error(`Unsafe application output pattern in ${file}`)
}
console.log(`PASS: ${scanned} source/build files scanned for credential patterns and application logging/raw HTML. This is not proof that every possible secret is absent.`)
