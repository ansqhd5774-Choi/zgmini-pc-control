// GitHub Actions security audit (source-only) on the existing isolated Windows CI.
// Public MIT tool zizmorcore/zizmor v1.33.1, official x64 Windows release.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {changedFiles} from './c996-source-checks.mjs';
import {assessPublicSourceCi} from './public-source-ci-guard.mjs';
import {verifyPublicMergeCheckout} from './public-ci-merge-tree.mjs';

export const ZIZMOR_VERSION='1.33.1';
export const ZIZMOR_ZIP_SHA256='f02ebeedf651da468b4de19d31f0609050af74e11be41dc46d82e355cf44f68b';
const URL='https://github.com/zizmorcore/zizmor/releases/download/v1.33.1/zizmor-x86_64-pc-windows-msvc.zip';
export const ZIZMOR_LINUX_SHA256='3e6a301c7a820a2501915f5a9de8c0486da82bdec7965f068477538a98743d43';
const LINUX_URL='https://github.com/zizmorcore/zizmor/releases/download/v1.33.1/zizmor-x86_64-unknown-linux-gnu.tar.gz';
export function selectZizmorRelease(env,event,platform=process.platform,arch=process.arch){
 if(env?.RUNNER_OS==='Windows'&&platform==='win32'&&arch==='x64')
  return {url:URL,sha256:ZIZMOR_ZIP_SHA256,archive:'zizmor.zip',curl:'curl.exe',tar:'tar.exe',platform};
 if(env?.RUNNER_OS==='Linux'&&env.RUNNER_ARCH==='X64'&&platform==='linux'&&arch==='x64'&&assessPublicSourceCi({event,env}).status==='PASS')
  return {url:LINUX_URL,sha256:ZIZMOR_LINUX_SHA256,archive:'zizmor.tar.gz',curl:'curl',tar:'tar',platform};
 throw Error('ZIZMOR_ISOLATED_PR_REQUIRED');
}


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
// Print only validated rule identifiers when a strict offline audit fails.
// Never expose the original findings, source excerpts, files or matched literals.
export function summarizeZizmorRuleIds(stdout,stderr){
 const texts=[stdout,stderr];
 if(texts.some(t=>typeof t!=='string'||t.length>8*1024*1024))
   return [];
 const ids=new Set();
 for(const source of texts){
  for(const match of source.matchAll(/(?:^|\n)\s*(?:error|warning|note|info)\[([a-z][a-z0-9-]{0,79})\]/g)){
   if(ids.size>=64)break;
   ids.add(match[1]);
  }
 }
 return [...ids].sort();
}

function run(cmd,args){
 const p=spawnSync(cmd,args,{windowsHide:true,stdio:'pipe',encoding:'utf8',
   timeout:120000,maxBuffer:8*1024*1024});
 if(p.error||p.status!==0)throw Error('ZIZMOR_SETUP_FAILED');
}
export async function auditChangedActions(){
 if(process.env.GITHUB_REPOSITORY!=='ansqhd5774-Choi/zgmini-pc-control'
   ||process.env.GITHUB_EVENT_NAME!=='pull_request'
   ||!process.env.RUNNER_TEMP)throw Error('ZIZMOR_ISOLATED_PR_REQUIRED');
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 const release=selectZizmorRelease(process.env,event);
 if(release.platform==='linux')verifyPublicMergeCheckout(event,process.env);
 const files=selectChangedActionFiles(await changedFiles());
 if(!files.length){console.log('ZIZMOR_NO_CHANGED_WORKFLOWS');return;}
 const folder=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP,'zgmini-zizmor-'));
 try{
   const archive=path.join(folder,release.archive);
   run(release.curl,['--fail','--location','--silent','--show-error',
     '--max-time','90','--output',archive,release.url]);
   verifyZizmorArchive(fs.readFileSync(archive),release.sha256);
   run(release.tar,['-xf',archive,'-C',folder]);
   const binaries=fs.readdirSync(folder,{recursive:true})
     .map(relative=>path.join(folder,relative))
     .filter(file=>path.basename(file)===(release.platform==='win32'?'zizmor.exe':'zizmor')&&fs.lstatSync(file).isFile());
   if(binaries.length!==1)throw Error('ZIZMOR_BINARY_MISSING');
   const exe=binaries[0];
   // Only modified CI configuration; no token, API call, or source leakage.
   const audit=spawnSync(exe,['--offline','--strict-collection',
      '--min-severity=medium','--min-confidence=high','--color=never',...files],{
     cwd:process.cwd(),windowsHide:true,stdio:'pipe',encoding:'utf8',
     timeout:120000,maxBuffer:8*1024*1024});
   // Avoid echoing potentially sensitive action YAML excerpts or literals.
   if(audit.error||audit.status!==0){
     const ids=summarizeZizmorRuleIds(audit.stdout??'',audit.stderr??'');
     console.log(ids.length?'ZIZMOR_FINDING_RULE_IDS='+ids.join(','):
       'ZIZMOR_FINDING_RULE_IDS_UNAVAILABLE');
     throw Error('ZIZMOR_ACTION_SECURITY_FAILED_'+String(audit.status??'EXEC'));
   }
   console.log('PASS: zizmor audited '+files.length+' modified workflow/action file(s).');
 }finally{
   fs.rmSync(folder,{recursive:true,force:true});
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
 auditChangedActions().catch(e=>{console.error(e.message);process.exitCode=1;});
}
