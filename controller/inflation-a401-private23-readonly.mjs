// Fixed A entry; reuses W01's approved parser instead of duplicating it.
// Requires the existing B-approved immutable source bundle in host.json.
import fs from 'node:fs';import path from 'node:path';
import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
export const A401_ENTRY='scripts/pc-writer/inflation-a401-baseline23-readonly.mjs';
export const A407_ENTRY='scripts/pc-writer/inflation-a407-integrity-readonly.mjs';
const A407_FILES=new Set([
 'lib/inflation-causal-candidates-public-7-catalog.mjs',
 'lib/inflation-causal-public-catalog.mjs',
 'scripts/pc-writer/inflation-a401-baseline23-readonly.mjs',
 A407_ENTRY,
 'scripts/pc-writer/inflation-causal-candidates-public-7-preview-r1.mjs',
 'scripts/pc-writer/inflation-causal-public-preview-r1.mjs',
 'worker/inflation-causal-candidates-public-7-r1.mjs',
 'worker/inflation-causal-public-r1.mjs'
]);
// Only the two W01 static-import worker modules are permitted under worker/.
const A401_WORKER_MODULES=new Set([
 'worker/inflation-causal-public-r1.mjs',
 'worker/inflation-causal-candidates-public-7-r1.mjs'
]);
const IDS=['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'];
const EXTRA=['2','16','24','29'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const need=(v,c)=>{if(!v)throw Object.assign(Error(c),{code:c});};
const stop=code=>({status:'BLOCKED',code,providerCalls:0,operationalWrites:0,d1Writes:0,sqliteWrites:0});
export function summarizeA401(body){
 need(body&&['PASS','PARTIAL'].includes(body.status)&&body.expected===23&&
  ['providerCalls','sqliteWrites','d1Writes','sourceWrites','taskChanges'].every(k=>body[k]===0),
  'A401_REPORT_INVALID');
 const rows=(items,ids)=>{
  need(Array.isArray(items)&&items.length===ids.length&&new Set(items.map(x=>x?.id)).size===ids.length&&
   items.every(x=>ids.includes(x.id)&&['PRESENT_VALID','UNVERIFIED'].includes(x.status)),'A401_REPORT_IDS');
  return items.map(x=>({id:x.id,status:x.status}));
 };
 const original=rows(body.original,IDS),additional=rows(body.additional,EXTRA);
 const originalReady=original.filter(x=>x.status==='PRESENT_VALID').length;
 const additionalReady=additional.filter(x=>x.status==='PRESENT_VALID').length;
 const verified=originalReady+additionalReady;
 need(body.originalReady===originalReady&&body.additionalReady===additionalReady&&body.verified===verified&&
  (body.status==='PASS'?verified===23:verified<23),'A401_REPORT_COUNTS');
 return {status:verified===23?'PASS':'BLOCKED',code:verified===23?'A401_PRIVATE23_SOURCE_READBACK_VERIFIED':'A401_PRIVATE23_SOURCE_READBACK_INCOMPLETE',
  expected:23,verified,originalReady,additionalReady,original,additional,
  evidenceScope:'APPROVED_PRIVATE_SOURCE_READBACK',sqliteOpened:verified===23?true:null,sqliteReadOnly:true,providerCalls:0,operationalWrites:0,d1Writes:0,sqliteWrites:0};
}
export function stageA401Bundle(request,{host,workspace},entrypoint=A401_ENTRY){
 const isA407=entrypoint===A407_ENTRY;
 need(entrypoint===A401_ENTRY||isA407,'A401_ENTRY_DENIED');
 need(request.sourceRepository==='ansqhd5774-Choi/zgmini'&&request.sourceBranch==='main'&&
  /^[a-f0-9]{40}$/.test(request.sourceSha??''),'A401_SOURCE_SCOPE');
 const a=host?.approvedSources?.[request.sourceSha];
 need(a?.branch==='main'&&a.entrypoint===entrypoint&&path.isAbsolute(a.root??'')&&
  /^[a-f0-9]{64}$/.test(a.manifestSha256??'')&&path.isAbsolute(workspace??''),'A401_BUNDLE_NOT_APPROVED');
 const root=fs.realpathSync(a.root),regular=p=>{
  const st=fs.lstatSync(p),real=fs.realpathSync(p);
  need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=2_000_000&&real.startsWith(root+path.sep),'A401_BUNDLE_FILE');
  return fs.readFileSync(p);
 };
 const raw=regular(path.join(root,'manifest.json'));need(hash(raw)===a.manifestSha256,'A401_MANIFEST_DRIFT');
 const m=JSON.parse(raw);
 need(m.sourceSha===request.sourceSha&&m.sourceBranch==='main'&&m.entrypoint===entrypoint&&
  m.files&&typeof m.files==='object'&&!Array.isArray(m.files)&&
  Object.keys(m.files).length>0&&Object.keys(m.files).length<=64&&Object.hasOwn(m.files,entrypoint),'A401_MANIFEST_SCOPE');
 if(isA407)need(m.schema==='ZGMINI_PC_SOURCE_BUNDLE_MANIFEST_V1'&&
  m.sourceRepository==='ansqhd5774-Choi/zgmini'&&Object.keys(m.files).length===8&&
  Object.keys(m.files).every(rel=>A407_FILES.has(rel)),'A407_BUNDLE_SCOPE');
 const entries=[];let total=0;
 for(const[rel,digest]of Object.entries(m.files)){
  need((/^(?:lib|scripts\/pc-writer)\/[a-zA-Z0-9_./-]+\.mjs$/.test(rel)||A401_WORKER_MODULES.has(rel))&&
   !rel.split('/').some(x=>!x||x==='.'||x==='..')&&/^[a-f0-9]{64}$/.test(digest),'A401_BUNDLE_PATH');
  const b=regular(path.join(root,'source',rel));total+=b.length;
  need(hash(b)===digest&&total<=8_000_000,'A401_SOURCE_BYTES_DRIFT');entries.push([rel,b]);
 }
 const dest=path.join(workspace,isA407?'a407-approved-source':'a401-approved-source');fs.mkdirSync(dest);
 for(const[rel,b]of entries){const file=path.join(dest,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,b,{flag:'wx'});}
 return {entry:path.join(dest,entrypoint),cwd:dest};
}
export function inspectA401Private23(request,context,{run=spawnSync}={}){
 try{
  need(typeof context.dataRoot==='string'&&path.win32.normalize(context.dataRoot).toLowerCase()===String.raw`E:\ZGmini\data`.toLowerCase(),'A401_DATA_ROOT_DENIED');
  const staged=stageA401Bundle(request,context);
  const env={SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,
   PATH:path.dirname(process.execPath),TEMP:context.workspace,TMP:context.workspace};
  const r=run(process.execPath,['--max-old-space-size=128',staged.entry],{
   cwd:staged.cwd,env,windowsHide:true,shell:false,encoding:'utf8',timeout:45000,maxBuffer:32768});
  need(!r.error&&!r.signal&&[0,1].includes(r.status),'A401_CHILD_INCOMPLETE');
  const b=JSON.parse(r.stdout.trim());need(r.status===(b.status==='PASS'?0:1),'A401_CHILD_STATUS_MISMATCH');
  return summarizeA401(b);
 }catch(e){return stop(/^A401_[A-Z0-9_]+$/.test(e.code??'')?e.code:'A401_READBACK_UNVERIFIED');}
}
