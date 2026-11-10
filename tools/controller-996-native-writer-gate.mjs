// #996 evidence-based cooperative Writer exclusion, source-only/no CLI.
// The old controller-install lease blocks known installed update paths; the
// dedicated C recovery claim blocks known host R6 recovery. This does NOT
// prove a filesystem-wide exclusive lock against non-cooperative writers.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {RECOVERY_996} from './controller-996-c-transaction.mjs';

const ROOT='E:/ZGmini/automation/pc-maintenance';
const REPO='E:/ZGmini/projects/zgmini-pc-control';
const REQUEST=RECOVERY_996.requestId;
const EXPECT=Object.freeze({
 ledger:'c6276bcf78ee96d8858e91621c85437abb5377108fe6c5b5681bf9b617743930',
 owner:'d6329b4d82530f9a1ca574647f050fff9243b698bb9dd314975b19ed171e40bc',
 marker:'4dc51f7e3a1cd84ce94ddf993e4a1cfbb319b050447dfbb5ccf0c38434a0b09b',
 backlog:'d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780',
 maintainer:'a5ed876c520a844a33bdf6cc137ac8015f686ed416aff6370389440ad6e3cba5',
});
const sourcePaths=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
 'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
 'tools/update.mjs','tools/maintenance-ancestry.vbs',
 'tools/source-bundle-register.mjs'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};

function readSafe(root,relative,maxSize=2_000_000){
 need(typeof relative==='string'&&relative.split('/').every(p=>
  p&&p!=='.'&&p!=='..'&&!p.includes('\\')),'C_WRITER_PATH_NOT_FIXED');
 let p=root;
 for(const part of [null,...relative.split('/')]){
  if(part!==null)p=path.join(p,part);
  const st=fs.lstatSync(p);
  need(!st.isSymbolicLink(),'C_WRITER_PATH_REDIRECT');
 }
 const st=fs.statSync(p);
 need(st.isFile()&&st.size<=maxSize,'C_WRITER_FILE_UNSAFE');
 return fs.readFileSync(p);
}
const asJson=bytes=>{try{return JSON.parse(bytes);}catch{
 need(false,'C_WRITER_EVIDENCE_JSON_INVALID');}};
const fromGit=(commit,rel)=>execFileSync('git',['show',`${commit}:${rel}`],{
 cwd:REPO,windowsHide:true,timeout:30000,maxBuffer:3_000_000});
const realIsAlive=pid=>{try{process.kill(pid,0);return true;}
 catch(e){return e?.code==='ESRCH'?false:null;}};

export function create996NativeCooperativeWriterGate({root=ROOT,testOnly=false,
 claimStore,sourceRead=fromGit,isPidAlive=realIsAlive,
 expectedDigests=EXPECT}={}){
 if(testOnly)need(process.platform!=='win32'&&path.isAbsolute(root)&&
  path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&
  path.basename(root).startsWith('zgmini-996-test-')&&
  sourceRead!==fromGit,'C_WRITER_TEST_ROOT_REJECTED');
 else need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
  !process.env.RUNNER_NAME&&
  path.win32.normalize(root).toLowerCase()===
   path.win32.normalize(ROOT).toLowerCase()&&
  sourceRead===fromGit&&isPidAlive===realIsAlive&&
  expectedDigests===EXPECT,
  'C_WRITER_ORIGINAL_WINDOWS_REQUIRED');
 need(claimStore&&typeof claimStore.ownClaimReadback==='function',
  'C_WRITER_CLAIM_PORT_MISSING');
 return Object.freeze({
  proveExclusiveWriter({requestId,ownerNonce}={}){
   need(requestId===REQUEST&&typeof ownerNonce==='string'&&
    /^[a-fA-F0-9-]{16,80}$/.test(ownerNonce),
    'C_WRITER_REQUEST_OR_NONCE_INVALID');
   const own=claimStore.ownClaimReadback();
   need(own?.requestId===REQUEST&&own?.nonce===ownerNonce&&
    own.pid===process.pid,'C_WRITER_OWN_CLAIM_NOT_CURRENT');
   const ledger=readSafe(root,`ledger/${REQUEST}.json`);
   const owner=readSafe(root,'leases/controller-install/owner.json');
   const marker=readSafe(root,'leases/controller-install/RECOVERY_REQUIRED.json');
   const backlog=readSafe(root,`backlog/${REQUEST}.json`);
   const manifest=readSafe(root,'MAINTENANCE_INSTALL.json');
   need(sha(ledger)===expectedDigests.ledger&&
    sha(owner)===expectedDigests.owner&&
    sha(marker)===expectedDigests.marker&&
    sha(backlog)===expectedDigests.backlog&&
    sha(manifest)===expectedDigests.maintainer,
    'C_WRITER_PINNED_ORIGINAL_DRIFT');
   const o=asJson(owner),m=asJson(marker),l=asJson(ledger),b=asJson(backlog);
   need(Number.isSafeInteger(o.pid)&&o.pid>0&&
    typeof o.nonce==='string'&&o.nonce===m.nonce&&
    m.requestOwnerPid===o.pid&&isPidAlive(o.pid)===false,
    'C_WRITER_ORIGINAL_OWNER_ALIVE_OR_UNVERIFIED');
   need(l.requestId===REQUEST&&l.status==='RECOVERY_REQUIRED'&&
    l.firstFail==='INTAKE_PAUSED'&&b.requestId===REQUEST&&
    b.resumedAt===null,'C_WRITER_LEDGER_OR_BACKLOG_PHASE_DRIFT');
   const installed=asJson(manifest);
   need(installed.schema==='ZGMINI_PC_MAINTENANCE_INSTALL_V1'&&
    installed.sourceSha===RECOVERY_996.maintainerSha&&
    installed.files&&typeof installed.files==='object'&&
    !Array.isArray(installed.files)&&
    Object.keys(installed.files).length===sourcePaths.length&&
    sourcePaths.every(rel=>typeof installed.files[rel]==='string'&&
     /^[a-f0-9]{64}$/.test(installed.files[rel])),
    'C_WRITER_INSTALLED_SOURCE_MANIFEST_DRIFT');
   for(const rel of sourcePaths){
    const current=readSafe(root,rel);
    need(sha(current)===installed.files[rel]&&
     current.equals(sourceRead(RECOVERY_996.maintainerSha,rel)),
     'C_WRITER_INSTALLED_CODE_DRIFT');
   }
   // Only known cooperating flows covered by the verified installed code.
   // The original install lease remains held throughout backlog close.
   return true;
  },
 });
}
