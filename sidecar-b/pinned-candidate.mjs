// Fixed candidate file read from an exact reviewed control-repo commit.
// Never downloads arbitrary URLs or takes a candidate path from an Issue.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateManifest,verifyCandidateBytes} from './contract.mjs';
export const APPROVED_CANDIDATE='sidecar-b/approved/archive-run.mjs';
const fail=c=>{throw Object.assign(Error(c),{code:c});};
const need=(ok,c)=>{if(!ok)fail(c);};
const gitBins=['C:\\Program Files\\Git\\cmd\\git.exe',
 'C:\\Program Files\\Git\\bin\\git.exe'];
const git=(root,args)=>{
 const exe=gitBins.find(f=>fs.existsSync(f));
 need(!!exe,'SIDECAR_B_CANDIDATE_GIT_STOP');
 return spawnSync(exe,['--no-optional-locks','-C',root,...args],{
  shell:false,encoding:'utf8',windowsHide:true,timeout:15000,
  env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'}
 });
};
export function readPinnedSidecarCandidate({candidateRoot,manifest,runGit=git}){
 validateManifest(manifest);
 need(process.platform==='win32'&&
  typeof candidateRoot==='string'&&path.win32.isAbsolute(candidateRoot),
  'SIDECAR_B_CANDIDATE_ROOT_STOP');
 const head=runGit(candidateRoot,['rev-parse','HEAD']);
 need(head?.status===0&&head.stdout?.trim()===manifest.approvedSourceSha,
  'SIDECAR_B_CANDIDATE_SOURCE_STOP');
 need(runGit(candidateRoot,['ls-files','--error-unmatch','--',
  APPROVED_CANDIDATE]).status===0,
  'SIDECAR_B_CANDIDATE_UNTRACKED_STOP');
 need(runGit(candidateRoot,['diff','--quiet','HEAD','--',
  APPROVED_CANDIDATE]).status===0&&
  runGit(candidateRoot,['diff','--cached','--quiet','HEAD','--',
  APPROVED_CANDIDATE]).status===0,
  'SIDECAR_B_CANDIDATE_DIRTY_STOP');
 const full=path.win32.join(candidateRoot,...APPROVED_CANDIDATE.split('/'));
 const base=path.win32.join(candidateRoot,'sidecar-b','approved');
 let bytes;
 try{
  const st=fs.lstatSync(full),dir=fs.lstatSync(base);
  need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=131072&&
   dir.isDirectory()&&!dir.isSymbolicLink(),
   'SIDECAR_B_CANDIDATE_TYPE_STOP');
  const rootReal=fs.realpathSync.native(candidateRoot);
  const dirReal=fs.realpathSync.native(base);
  const fileReal=fs.realpathSync.native(full);
  need(path.win32.normalize(dirReal).toLowerCase()===
    path.win32.normalize(path.win32.join(rootReal,'sidecar-b','approved')).toLowerCase()&&
    path.win32.normalize(fileReal).toLowerCase()===
    path.win32.normalize(path.win32.join(dirReal,'archive-run.mjs')).toLowerCase(),
    'SIDECAR_B_CANDIDATE_REDIRECT_STOP');
  bytes=fs.readFileSync(full);
 }catch(e){
  if(e?.code?.startsWith('SIDECAR_B_'))throw e;
  fail('SIDECAR_B_CANDIDATE_MISSING_STOP');
 }
 return verifyCandidateBytes(manifest,bytes);
}
