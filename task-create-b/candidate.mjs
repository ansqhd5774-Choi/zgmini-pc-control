// Read a reviewed W06 pure candidate builder from its pinned application SHA.
// Only the existing single-file module may be imported. No arbitrary command.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {sha256,verifyTaskCreateBCandidate,SOURCE_ROOT} from './contract.mjs';

const CANDIDATE='scripts/pc-writer/w06-minute-task-candidate.mjs';
const stop=code=>{throw Object.assign(Error(code),{code});};
const need=(x,c)=>{if(!x)stop(c);};
const gitBins=[String.raw`C:\Program Files\Git\cmd\git.exe`,
 String.raw`C:\Program Files\Git\bin\git.exe`];
const git=(root,args)=>{
 const exe=gitBins.find(x=>fs.existsSync(x));
 need(!!exe,'TASK_CREATE_B_CANDIDATE_GIT_MISSING_STOP');
 return spawnSync(exe,['--no-optional-locks','-C',root,...args],{
  shell:false,encoding:'utf8',windowsHide:true,timeout:15000,
  env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'}
 });
};
export async function loadW06TaskCandidate(proof,{root,account,now,runGit=git}={}){
 const m=proof?.manifest;
 need(process.platform==='win32'&&typeof root==='string'&&path.win32.isAbsolute(root)&&
  typeof account==='string'&&account.length>0&&now instanceof Date&&
  Number.isFinite(now.getTime()),
  'TASK_CREATE_B_CANDIDATE_HOST_SCOPE_STOP');
 const actual=runGit(root,['rev-parse','HEAD']);
 need(actual?.status===0&&actual.stdout?.trim()===m?.candidateSourceSha,
  'TASK_CREATE_B_CANDIDATE_SOURCE_STOP');
 for(const args of [['ls-files','--error-unmatch','--',CANDIDATE],
  ['diff','--quiet','HEAD','--',CANDIDATE],
  ['diff','--cached','--quiet','HEAD','--',CANDIDATE]]){
  need(runGit(root,args).status===0,'TASK_CREATE_B_CANDIDATE_GIT_STOP');
 }
 const file=path.join(root,...CANDIDATE.split('/'));
 const parent=path.dirname(file);
 let content;
 try{
  const st=fs.lstatSync(file),dir=fs.lstatSync(parent);
  need(st.isFile()&&!st.isSymbolicLink()&&st.size<20000&&
   dir.isDirectory()&&!dir.isSymbolicLink(),'TASK_CREATE_B_CANDIDATE_FILE_STOP');
  const targetReal=fs.realpathSync.native(file),parentReal=fs.realpathSync.native(parent);
  need(path.win32.normalize(targetReal).toLowerCase()===
   path.win32.normalize(path.join(parentReal,path.basename(file))).toLowerCase(),
   'TASK_CREATE_B_CANDIDATE_REDIRECT_STOP');
  content=fs.readFileSync(file);
 }catch(e){if(e?.code?.startsWith('TASK_CREATE_B_'))throw e;
  stop('TASK_CREATE_B_CANDIDATE_FILE_STOP');}
 need(sha256(content)===m.candidateFileSha256,
  'TASK_CREATE_B_CANDIDATE_BLOB_SHA_STOP');
 const {buildW06MinuteTaskCandidate}=await import(pathToFileURL(file).href);
 need(typeof buildW06MinuteTaskCandidate==='function',
  'TASK_CREATE_B_CANDIDATE_EXPORT_STOP');
 const data=buildW06MinuteTaskCandidate({sourceRoot:SOURCE_ROOT,account,now});
 need(data?.status==='SOURCE_CANDIDATE_NOT_APPROVED'&&
  data.taskName===m.taskName&&data.effectRequiresApproval===
   'CREATE_ENABLE_ONE_TASK_CNN_HTTP_SQLITE_D1_WITH_EXACT_CAS_AND_ROLLBACK',
  'TASK_CREATE_B_CANDIDATE_EFFECT_STOP');
 const enabled=data.taskXml,disabled=enabled.replace(
  /(<Settings>[\s\S]*?<Enabled>)true(<\/Enabled>)/,'$1false$2');
 need(disabled!==enabled,'TASK_CREATE_B_CANDIDATE_DISABLE_STOP');
 const candidate={launcher:Buffer.from(data.launcherText,'utf8'),
  enabledXml:Buffer.from(enabled,'utf16le'),
  disabledXml:Buffer.from(disabled,'utf16le')};
 verifyTaskCreateBCandidate(proof,candidate);
 return candidate;
}
