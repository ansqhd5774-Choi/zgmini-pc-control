// Credential-isolated GitHub Actions step. Never forwards GITHUB_TOKEN to
// the installed Controller entry or its worker; writes only approved scope data.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateRequest} from './common.mjs';
import {blockedPayload,preimageStageFile,stagedPayload} from './preimage-manifest-contract.mjs';

const CONTROL='ansqhd5774-Choi/zgmini-pc-control';
const stop=code=>{throw Object.assign(new Error(code),{code});};

export async function stagePreimageManifest({env,event,policy,fetchImpl=fetch}={}){
 if(env.GITHUB_REPOSITORY!==CONTROL||event?.repository?.private!==true||
  env.GITHUB_ACTOR!=='ansqhd5774-Choi'||event?.issue?.user?.login!=='ansqhd5774-Choi'||
  env.GITHUB_EVENT_NAME!=='issues'||event?.action!=='opened'||
  !event.issue?.labels?.some(x=>x.name==='pc-job'))stop('PREIMAGE_STAGE_EVENT_STOP');
 let request;
 try{request=validateRequest(JSON.parse(event.issue.body),policy);}
 catch{stop('PREIMAGE_STAGE_EVENT_STOP');}
 if(!Object.hasOwn(request,'preimageManifestPath'))return null;
 if(!/^[0-9a-f]{40}$/.test(env.GITHUB_SHA??''))stop('PREIMAGE_STAGE_EVENT_STOP');
 const token=env.GITHUB_TOKEN;
 if(typeof token!=='string'||token.length<20)stop('PREIMAGE_STAGE_AUTH_UNAVAILABLE');
 const segments=request.preimageManifestPath.split('/').map(encodeURIComponent).join('/');
 const url=`https://api.github.com/repos/${CONTROL}/contents/${segments}?ref=${env.GITHUB_SHA}`;
 let response,data;
 try{
  response=await fetchImpl(url,{method:'GET',headers:{Authorization:`Bearer ${token}`,
   Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
   'User-Agent':'zgmini-preimage-readonly-v1'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)stop('PREIMAGE_STAGE_FETCH_STOP');
  const body=await response.text();
  if(body.length>64_000)stop('PREIMAGE_STAGE_FETCH_STOP');
  data=JSON.parse(body);
 }catch{stop('PREIMAGE_STAGE_FETCH_STOP');}
 if(data?.type!=='file'||data?.encoding!=='base64'||
  typeof data.content!=='string'||data.content.length>24_000)
  stop('PREIMAGE_STAGE_FETCH_STOP');
 const encoded=data.content.replace(/\s/g,'');
 const bytes=Buffer.from(encoded,'base64');
 if(bytes.toString('base64')!==encoded)stop('PREIMAGE_STAGE_FETCH_STOP');
 return stagedPayload({request,githubSha:env.GITHUB_SHA,bytes});
}

export function verifyInstalledStageSource(root,host,{fileSystem=fs}={}){
 // The preflight process holds a GitHub credential. Require the installed
 // maintainer's verified hashes before accessing it, including this script.
 const required=['controller/preimage-manifest-stager.mjs',
  'controller/preimage-manifest-contract.mjs','controller/common.mjs'];
 if(!host?.controllerFiles||!required.every(x=>
   /^[0-9a-f]{64}$/.test(host.controllerFiles[x]??'')))
  stop('PREIMAGE_STAGE_SOURCE_NOT_ATTESTED');
 for(const rel of Object.keys(host.controllerFiles)){
  const file=path.join(root,...rel.split('/'));
  let digest;
  try{digest=createHash('sha256').update(fileSystem.readFileSync(file)).digest('hex');}
  catch{stop('PREIMAGE_STAGE_SOURCE_NOT_ATTESTED');}
  if(digest!==host.controllerFiles[rel])stop('PREIMAGE_STAGE_SOURCE_NOT_ATTESTED');
 }
}

async function main(env=process.env){
 const runRoot=path.dirname(fileURLToPath(import.meta.url));
 const root=path.dirname(runRoot);
 let output;
 try{
 const host=JSON.parse(fs.readFileSync(path.join(root,'host.json'),'utf8'));
 verifyInstalledStageSource(root,host);
 const policy=JSON.parse(fs.readFileSync(path.join(runRoot,'../config/operations.json'),'utf8'));
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 output=await stagePreimageManifest({env,event,policy});
 }catch(error){output=blockedPayload(error.code);}
 if(output){
  const file=preimageStageFile(env);
  fs.writeFileSync(file,JSON.stringify(output)+'\n',{flag:'wx',mode:0o600});
 }
 process.stdout.write('PREIMAGE_SCOPE_STAGE_COMPLETE\n');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(()=>{process.stderr.write('PREIMAGE_SCOPE_STAGE_UNAVAILABLE\n');process.exitCode=1;});
