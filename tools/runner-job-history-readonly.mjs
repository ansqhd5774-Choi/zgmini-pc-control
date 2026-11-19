// Narrow, read-only correlation of previously cancelled GitHub jobs to local
// self-hosted Runner _diag metadata. Never upload log lines, paths, PIDs,
// command lines, environment, tokens, or raw file names.
import fs from 'node:fs';
import path from 'node:path';

const MAX_LOG_BYTES=4*1024*1024;
const TAIL_BYTES=128*1024;
const MAX_CANDIDATES=16;
const MAX_LIST=3000;
const LOG_NAME=/^(Runner|Worker)_(\d{8})-(\d{6})-utc\.log$/;
const FIXED_ROOT='E:/ZGmini/automation/pc-control';

function fail(code){throw Object.assign(new Error(code),{code});}
function exact(obj,keys){return obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).sort().join(',')===keys.slice().sort().join(',');}

export function validateRunnerJobRefs(refs,now=Date.now()){
 if(!Array.isArray(refs)||refs.length<1||refs.length>3)
  fail('RUNNER_JOB_REFERENCES_INVALID');
 const used=new Set();
 return refs.map(x=>{
  if(!exact(x,['runId','jobId','seat','startedAtUtc','completedAtUtc'])||
    !/^[1-9]\d{8,17}$/.test(String(x.runId))||
    !/^[1-9]\d{8,17}$/.test(String(x.jobId))||
    !Number.isInteger(x.seat)||x.seat<1||x.seat>6||
    typeof x.startedAtUtc!=='string'||
    typeof x.completedAtUtc!=='string'||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x.startedAtUtc)||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x.completedAtUtc))
    fail('RUNNER_JOB_REFERENCE_SHAPE_INVALID');
  const start=Date.parse(x.startedAtUtc),end=Date.parse(x.completedAtUtc);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||
    end-start>20*60000||start<now-14*86400000||start>now+300000||
    end>now+300000)fail('RUNNER_JOB_REFERENCE_WINDOW_INVALID');
  const key=String(x.runId)+':'+String(x.jobId);
  if(used.has(key))fail('RUNNER_JOB_REFERENCE_DUPLICATE');
  used.add(key);
  return {runId:String(x.runId),jobId:String(x.jobId),seat:x.seat,
    startedAtUtc:x.startedAtUtc,completedAtUtc:x.completedAtUtc};
 });
}

function nameTime(name){
 const m=LOG_NAME.exec(name);
 if(!m)return null;
 const s=m[2],t=m[3];
 const d=Date.parse(s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)+
  'T'+t.slice(0,2)+':'+t.slice(2,4)+':'+t.slice(4,6)+'Z');
 return Number.isFinite(d)?{kind:m[1],at:d}:null;
}
function examineFile(filename,io){
 let fd=null;
 try{
  const st=io.lstatSync(filename);
  if(st.isSymbolicLink()||!st.isFile()||st.size>MAX_LOG_BYTES||
     st.size<0)return null;
  fd=io.openSync(filename,'r');
  const live=io.fstatSync(fd);
  if(!live.isFile()||live.size<0||live.size>MAX_LOG_BYTES)return null;
  const n=Math.min(TAIL_BYTES,live.size),bytes=Buffer.alloc(n);
  if(io.readSync(fd,bytes,0,n,Math.max(0,live.size-n))!==n)return null;
  return bytes.toString('utf8');
 }catch{return null;}finally{if(fd!==null)try{io.closeSync(fd);}catch{}}
}
export function inspectRunnerJobHistory(refs,{io=fs,root=FIXED_ROOT,
 now=Date.now()}={}){
 const valid=validateRunnerJobRefs(refs,now);
 return valid.map(ref=>{
  const base={runId:ref.runId,jobId:ref.jobId,seat:ref.seat,
   runnerCandidates:0,workerCandidates:0,filesRead:0,
   exactReferences:0,receivedHint:false,workerHint:false,
   cancelHint:false,classification:'DIAG_UNAVAILABLE'};
  const dir=path.join(root,'runners',String(ref.seat).padStart(2,'0'),'_diag');
  let entries;
  try{
   const st=io.lstatSync(dir);
   if(st.isSymbolicLink()||!st.isDirectory())return base;
   entries=io.readdirSync(dir,{withFileTypes:true});
   if(!Array.isArray(entries)||entries.length>MAX_LIST)return base;
  }catch{return base;}
  const start=Date.parse(ref.startedAtUtc),end=Date.parse(ref.completedAtUtc);
  const candidates=entries.filter(ent=>ent.isFile()&&!ent.isSymbolicLink())
   .map(ent=>({name:ent.name,meta:nameTime(ent.name)}))
   .filter(x=>x.meta&&x.meta.at<=end+120000&&
     x.meta.at>=start-(x.meta.kind==='Runner'?6*3600000:300000))
   .sort((a,b)=>b.meta.at-a.meta.at).slice(0,MAX_CANDIDATES);
  for(const x of candidates){
   if(x.meta.kind==='Runner')base.runnerCandidates++;
   else base.workerCandidates++;
   const raw=examineFile(path.join(dir,x.name),io);
   if(raw===null)continue;
   base.filesRead++;
   // A time-adjacent log does NOT prove it belongs to the requested job.
   // Only an exact GitHub run/job ID may permit additional bounded hints.
   const re=new RegExp('(^|[^0-9])('+ref.runId+'|'+ref.jobId+')(?![0-9])','g');
   const at=re.exec(raw);
   if(!at)continue;
   base.exactReferences++;
   const segment=raw.slice(Math.max(0,at.index-512),
     Math.min(raw.length,at.index+1536));
   base.receivedHint ||= /job request|job message received|job received/i.test(segment);
   base.workerHint ||= /start(?:ing|ed)? worker|worker process|start job/i.test(segment);
   base.cancelHint ||= /cancel(?:led|ing|ation)? (?:request|job)|job cancellation/i.test(segment);
  }
  base.classification=base.exactReferences>0?'EXACT_JOB_REFERENCE_IN_DIAG':
   base.filesRead>0?'TIME_ONLY_UNATTRIBUTED':
   candidates.length>0?'LOG_CANDIDATE_UNREADABLE':'NO_TIME_WINDOW_DIAG';
  return base;
 });
}
