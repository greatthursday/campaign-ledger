// Local preview only. Production remains a static GitHub Pages site.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const portFlag=process.argv.indexOf('--port');
const port=Number(portFlag>=0?process.argv[portFlag+1]:process.env.PORT??3000);
createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root.endsWith(sep)?root:root+sep))throw new Error('Outside root');const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]??'text/plain','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'0.0.0.0',()=>console.log(`Local: http://localhost:${port}`));
