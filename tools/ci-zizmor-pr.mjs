// GitHub Actions security audit (source-only) on the existing isolated Windows CI.
// Public MIT tool zizmorcore/zizmor v1.33.1, official x64 Windows release.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {changedFiles} from './c996-source-checks.mjs';

export const ZIZMOR_VERSION='1.33.1';
export const ZIZMOR_ZIP_SHA256='f02ebeedf651da468b4de19d31f0609050af74e11be41dc46d82e355cf44f68b';
const URL='https://github.com/zizmorcore/zizmor/releases/download/v1.33.1/zizmor-x86_64-pc-windows-msvc.zip';

export function selectChangedActionFiles(paths,exists=fs.existsSync){
 if(!Array.isArray(paths))throw Error('ZIZMOR_CHANGED_SCOPE_UNVERIFIED');
 return [...new Set(paths)].filter(p=>
   typeof p==='string'&&!p.includes('..')&&
   (/^\.github\/workflows\/[\w.-]+\.ya?ml$/.test(p)||
    /^\.github\/actions\/[\w./-]+\/action\.ya?ml$/.test(p))&&
   exists(p)).sort();
}
export function verifyZizmorArchive(content,expected=ZIZMOR_ZIP_SHA256){
 const hash=crypto.createHash('sha256').update(content).digest('hex');
 if(hash!==expected)throw Error('ZIZMOR_ARCHIVE_SHA256_MISMATCH');
 return true;
}
function run(cmd,args){
 const p=spawnSync(cmd,args,{windowsHide:true,stdio:'pipe',encoding:'utf8',
   timeout:120000,maxBuffer:8*1024*1024});
 if(p.error||p.status!==0)throw Error('ZIZMOR_SETUP_FAILED');
}
export async function auditChangedActions(){
 if(process.env.GITHUB_REPOSITORY!=='ansqhd5774-Choi/zgmini-pc-control'
   ||process.env.RUNNER_OS!=='Windows'
   ||process.env.GITHUB_EVENT_NAME!=='pull_request'
   ||!process.env.RUNNER_TEMP)throw Error('ZIZMOR_ISOLATED_PR_REQUIRED');
 const files=selectChangedActionFiles(await changedFiles());
 if(!files.length){console.log('ZIZMOR_NO_CHANGED_WORKFLOWS');return;}
 const folder=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP,'zgmini-zizmor-'));
 try{
   const archive=path.join(folder,'zizmor.zip');
   run('curl.exe',['--fail','--location','--silent','--show-error',
     '--max-time','90','--output',archive,URL]);
   verifyZizmorArchive(fs.readFileSync(archive));
   run('tar.exe',['-xf',archive,'-C',folder]);
   const exe=path.join(folder,'zizmor.exe');
   if(!fs.existsSync(exe))throw Error('ZIZMOR_BINARY_MISSING');
   // Only modified CI configuration; no token, API call, or source leakage.
   const audit=spawnSync(exe,['--offline','--strict-collection',
      '--min-severity=medium','--min-confidence=high','--color=never',...files],{
     cwd:process.cwd(),windowsHide:true,stdio:'pipe',encoding:'utf8',
     timeout:120000,maxBuffer:8*1024*1024});
   // Avoid echoing potentially sensitive action YAML excerpts or literals.
   if(audit.error||audit.status!==0)
     throw Error('ZIZMOR_ACTION_SECURITY_FAILED_'+String(audit.status??'EXEC'));
   console.log('PASS: zizmor audited '+files.length+' modified workflow/action file(s).');
 }finally{
   fs.rmSync(folder,{recursive:true,force:true});
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
 auditChangedActions().catch(e=>{console.error(e.message);process.exitCode=1;});
}
