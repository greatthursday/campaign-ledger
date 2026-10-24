// GitHub Contents API adapter. Credentials exist only in private instance memory.
import {exportJSON,importJSON} from './serialization.js';
export {exportJSON,importJSON,exportCSV} from './serialization.js';
export {validateCampaign} from './validation.js';
const API='https://api.github.com';
const MAX_BYTES=1024*1024;
export class StorageError extends Error {
  constructor(code,message){super(message);this.name='StorageError';this.code=code;}
}
export function normalizeGitHubConfig(input){
  const c=Object.fromEntries(['owner','repo','branch','path'].map(k=>[k,typeof input?.[k]==='string'?input[k].trim():'']));
  if(!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(c.owner)||!/^[-A-Za-z0-9_.]{1,100}$/.test(c.repo)||['.','..'].includes(c.repo)||c.repo.endsWith('.git'))throw new StorageError('CONFIG','Enter a GitHub owner and repository name, without a URL or .git suffix.');
  if(`${c.owner}/${c.repo}`.toLowerCase()==='greatthursday/campaign-ledger')throw new StorageError('CONFIG','Use a separate private campaign-data repository, not the app source repository.');
  if(!c.branch||c.branch.length>200||/\s|[~^:?*\[\\]|\.\.|@\{|\/\/|^\/|\/$|\.$/.test(c.branch)||c.branch.startsWith('-')||c.branch.split('/').some(s=>s.endsWith('.lock')))throw new StorageError('CONFIG','Enter a valid branch name, such as main.');
  if(!c.path.endsWith('.json')||c.path.length>300||c.path.split('/').some(s=>!s||s==='.'||s==='..'||!/^[A-Za-z0-9_.-]+$/.test(s))||c.path.startsWith('.github/'))throw new StorageError('CONFIG','Enter a relative JSON file path, such as campaign.json.');
  return c;
}
export function encodeContent(text){const bytes=new TextEncoder().encode(text);if(bytes.length>MAX_BYTES)throw new StorageError('SIZE','Campaign exceeds the 1 MiB file limit. Export JSON and split/archive the campaign before syncing.');let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);}
export function decodeContent(base64){try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(base64.replace(/\s/g,'')),ch=>ch.charCodeAt(0)));}catch{throw new StorageError('FORMAT','GitHub returned invalid UTF-8 campaign content.');}}
export class GitHubStorage {
  #config;#token;#fetch;#sha=null;#campaignId=null;#busy=false;#timeout;
  constructor(config,token,{fetchImpl=globalThis.fetch,timeoutMs=20000}={}){
    this.#config=normalizeGitHubConfig(config);
    if(typeof token!=='string'||!token.trim()||/\s/.test(token.trim()))throw new StorageError('TOKEN','Enter a repository-scoped fine-grained token.');
    this.#token=token.trim();this.#fetch=fetchImpl.bind(globalThis);this.#timeout=timeoutMs;
  }
  get config(){return {...this.#config};}
  fork(){if(!this.#token)throw new StorageError('TOKEN','Reconnect with a token to continue.');return new GitHubStorage(this.#config,this.#token,{fetchImpl:this.#fetch,timeoutMs:this.#timeout});}
  get loaded(){return this.#sha!==null;}
  get sha(){return this.#sha;}
  disconnect(){if(this.#busy)throw new StorageError('BUSY','Wait for the current GitHub operation to finish.');this.#token='';this.#sha=null;this.#campaignId=null;}
  async #run(fn){if(this.#busy)throw new StorageError('BUSY','A GitHub operation is already in progress.');if(!this.#token)throw new StorageError('TOKEN','Reconnect with a token to continue.');this.#busy=true;try{return await fn();}finally{this.#busy=false;}}
  #repoUrl(){return `${API}/repos/${encodeURIComponent(this.#config.owner)}/${encodeURIComponent(this.#config.repo)}`;}
  #fileUrl(){return `${this.#repoUrl()}/contents/${this.#config.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(this.#config.branch)}`;}
  async #request(url,{method='GET',body,missing=false}={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.#timeout);
    let response;
    try {
    try{response=await this.#fetch(url,{method,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${this.#token}`,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});}
    catch{throw new StorageError(method==='PUT'?'SAVE_UNCERTAIN':'NETWORK',method==='PUT'?'The save response was lost. GitHub may have saved it. Keep your work, export JSON, and check the remote file before retrying.':'Could not reach GitHub. Check your connection and try again.');}
    if(response.status===404&&missing)return null;
    if(!response.ok){
      const errors={401:['AUTH','GitHub rejected the token. It may be invalid or expired. Reconnect with a new token.'],403:['PERMISSION','GitHub denied access. Check the token’s repository selection, Contents permission, approval and API rate limit.'],404:['NOT_FOUND','Repository or branch not found, or the token cannot access it. Check the account, repository and branch.'],409:['CONFLICT','The remote file changed or GitHub rejected a conflicting update. Your local work has been kept.'],422:[method==='PUT'?'CONFLICT':'VALIDATION','GitHub rejected the update. The file may have changed, the branch may not exist, or repository rules may block the commit. Your local work has been kept.'],429:['RATE_LIMIT','GitHub rate limit reached. Wait and try again.']};
      const [code,message]=errors[response.status]??['GITHUB','GitHub could not complete this request. Your local work has been kept.'];throw new StorageError(code,message);
    }
    try{return await response.json();}catch{throw new StorageError(method==='PUT'?'SAVE_UNCERTAIN':'FORMAT',method==='PUT'?'GitHub returned an unreadable save response. The commit may exist; check the remote file before retrying.':'GitHub returned an unreadable response.');}
    }finally{clearTimeout(timer);}
  }
  async #verifyRepository(){const data=await this.#request(this.#repoUrl());if(data.private!==true)throw new StorageError('PRIVATE_REQUIRED','Campaign data must be stored in a private repository. No data was uploaded.');return data;}
  #checkFile(data){if(!data||data.type!=='file'||typeof data.sha!=='string'||!data.sha)throw new StorageError('FORMAT','The configured path must identify a regular GitHub file.');if(data.size>MAX_BYTES)throw new StorageError('SIZE','Remote campaign exceeds the supported 1 MiB file size.');return data;}
  async loadCampaign(){return this.#run(async()=>{
    await this.#verifyRepository();const data=await this.#request(this.#fileUrl(),{missing:true});
    if(data===null)throw new StorageError('FILE_NOT_FOUND','No campaign JSON was found at this path. Create it from the open campaign, or check the branch and path.');
    this.#checkFile(data);if(data.encoding!=='base64'||typeof data.content!=='string')throw new StorageError('FORMAT','GitHub did not return supported file contents.');
    let campaign;try{campaign=importJSON(decodeContent(data.content));}catch(error){if(error instanceof StorageError)throw error;throw new StorageError('INVALID_CAMPAIGN','The remote JSON is not a valid Campaign Ledger campaign. Local work has not been replaced.');}
    this.#sha=data.sha;this.#campaignId=campaign.id;return {campaign,sha:data.sha};
  });}
  async saveCampaign(campaign){
    // Validate and copy before awaiting network work, so later UI edits cannot alter the saved snapshot.
    const text=exportJSON(campaign),content=encodeContent(text),campaignId=campaign.id;
    return this.#run(async()=>{
      if(!this.#sha)throw new StorageError('LOAD_REQUIRED','Load the remote campaign before saving to an existing file.');
      if(campaignId!==this.#campaignId)throw new StorageError('CAMPAIGN_MISMATCH','This is a different campaign. Disconnect and choose a new file instead of overwriting the connected campaign.');
      await this.#verifyRepository();const current=await this.#request(this.#fileUrl(),{missing:true});
      if(current===null||this.#checkFile(current).sha!==this.#sha)throw new StorageError('CONFLICT','Another device changed or deleted the remote file. Your local work is safe. Export a JSON backup, then load the remote version to reconcile it.');
      return this.#put(content,campaignId,this.#sha);
    });
  }
  async initializeCampaign(campaign){const text=exportJSON(campaign),content=encodeContent(text),campaignId=campaign.id;return this.#run(async()=>{
    await this.#verifyRepository();
    if(await this.#request(this.#fileUrl(),{missing:true})!==null)throw new StorageError('CONFLICT','A file already exists at this path. Load it first; it has not been overwritten.');
    return this.#put(content,campaignId,null);
  });}
  async #put(content,campaignId,sha){const body={message:sha?'Update Campaign Ledger campaign':'Initialize Campaign Ledger campaign',content,branch:this.#config.branch,...(sha?{sha}:{})};
    const result=await this.#request(this.#fileUrl().split('?')[0],{method:'PUT',body});
    if(typeof result.content?.sha!=='string'||!result.content.sha)throw new StorageError('SAVE_UNCERTAIN','GitHub did not confirm the new file version. Check the remote file before retrying.');
    this.#sha=result.content.sha;this.#campaignId=campaignId;return {sha:this.#sha,commitSha:result.commit?.sha??null};
  }
}
