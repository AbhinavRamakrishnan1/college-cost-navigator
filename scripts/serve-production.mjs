import { createServer } from 'node:http'
import { readFile,stat } from 'node:fs/promises'
import { resolve,extname,sep } from 'node:path'
const root=resolve('dist'),config=JSON.parse(await readFile('vercel.json','utf8'))
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}
createServer(async(req,res)=>{
  for(const header of config.headers[0].headers)res.setHeader(header.key,header.value)
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)
    let target=resolve(root,`.${pathname}`)
    if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403);res.end();return}
    try{if(!(await stat(target)).isFile())throw new Error('directory')}catch{if(pathname.startsWith('/assets/')||pathname.startsWith('/scorecard/')){res.writeHead(404);res.end();return}target=resolve(root,'index.html')}
    res.setHeader('Content-Type',types[extname(target)]??'application/octet-stream')
    res.end(await readFile(target))
  }catch{res.writeHead(500);res.end('Unable to load application resource')}
}).listen(4173,'127.0.0.1',()=>console.log('Production test server: http://127.0.0.1:4173'))
