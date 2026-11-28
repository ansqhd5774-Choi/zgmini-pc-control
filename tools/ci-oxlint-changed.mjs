// Run free Oxlint on changed JS/TS source only on the existing isolated Windows CI host.
// Official MIT-licensed release: oxc-project/oxc oxlint_v1.95.0.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {changedFiles} from './c996-source-checks.mjs';
import {assessPublicSourceCi} from './public-source-ci-guard.mjs';
import {verifyPublicMergeCheckout} from './public-ci-merge-tree.mjs';

export const OXLINT_VERSION='1.95.0';
export const OXLINT_ARCHIVE_SHA256='8a0e8384ee8ff23892ff878dead150c8632fb447ca905e95aed2c5e6684ab921';
const DOWNLOAD='https://github.com/oxc-project/oxc/releases/download/oxlint_v1.95.0/oxlint-x86_64-pc-windows-msvc.zip';
export const OXLINT_LINUX_SHA256='180d51ffd469995f394ba379a4b6f73c55ddb98443df442e3e456951d874a5f1';
const LINUX_URL='https://github.com/oxc-project/oxc/releases/download/oxlint_v1.95.0/oxlint-x86_64-unknown-linux-gnu.tar.gz';
export function selectOxlintRelease(env,event,platform=process.platform,arch=process.arch){
 if(env?.RUNNER_OS==='Windows'&&platform==='win32'&&arch==='x64')
  return {url:DOWNLOAD,sha256:OXLINT_ARCHIVE_SHA256,archive:'oxlint.zip',curl:'curl.exe',tar:'tar.exe',platform};
 if(env?.RUNNER_OS==='Linux'&&env.RUNNER_ARCH==='X64'&&platform==='linux'&&arch==='x64'&&assessPublicSourceCi({event,env}).status==='PASS')
  return {url:LINUX_URL,sha256:OXLINT_LINUX_SHA256,archive:'oxlint.tar.gz',curl:'curl',tar:'tar',platform};
 throw Error('OXLINT_ISOLATED_PR_REQUIRED');
}

const SOURCE=/\.(?:mjs|cjs|js|jsx|ts|tsx)$/i;
export function selectSourceFiles(paths,exists=fs.existsSync){
 if(!Array.isArray(paths))throw Error('OXLINT_CHANGE_SCOPE_UNVERIFIED');
 return [...new Set(paths)].filter(p=>
  typeof p==='string'&&p.length>0&&
  !p.includes('..')&&!p.startsWith('/')&&
  !/^[a-z]:/i.test(p)&&SOURCE.test(p)&&
  !p.startsWith('node_modules/')&&exists(p)).sort();
}
export function verifyArchive(bytes,expected=OXLINT_ARCHIVE_SHA256){
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==expected)
   throw Error('OXLINT_ARCHIVE_SHA256_MISMATCH');
 return true;
}
function checkedRun(command,args){
 const p=spawnSync(command,args,{windowsHide:true,encoding:'utf8',
  stdio:'pipe',maxBuffer:8*1024*1024,timeout:120000});
 if(p.error||p.status!==0)throw Error('OXLINT_SETUP_FAILED');
}
export async function runChangedLint(){
 if(process.env.GITHUB_REPOSITORY!=='ansqhd5774-Choi/zgmini-pc-control'
  ||process.env.GITHUB_EVENT_NAME!=='pull_request'
  ||!process.env.RUNNER_TEMP)throw Error('OXLINT_ISOLATED_PR_REQUIRED');
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 const release=selectOxlintRelease(process.env,event);
 if(release.platform==='linux')verifyPublicMergeCheckout(event,process.env);
 const changed=await changedFiles();
 const files=selectSourceFiles(changed);
 if(files.length===0){console.log('OXLINT_NO_CHANGED_SOURCE');return;}
 const folder=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP,'zgmini-oxlint-'));
 try{
  const zip=path.join(folder,release.archive);
  checkedRun(release.curl,['--fail','--location','--silent','--show-error',
   '--max-time','90','--output',zip,release.url]);
  verifyArchive(fs.readFileSync(zip),release.sha256);
  checkedRun(release.tar,['-xf',zip,'-C',folder]);
  // Official ZIP file names/layouts differ by platform and release.
  // Identify the single platform executable by magic bytes.
  const executables=fs.readdirSync(folder,{recursive:true})
   .map(relative=>path.join(folder,relative))
   .filter(file=>fs.statSync(file).isFile()
     && (release.platform==='win32'
       ?fs.readFileSync(file).subarray(0,2).toString('ascii')==='MZ'
       :fs.readFileSync(file).subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46]))));
  if(executables.length!==1)throw Error('OXLINT_BINARY_MISSING');
  const exe=executables[0];
  // Do not echo source snippets or credential-looking literals to CI logs.
  const p=spawnSync(exe,files.map(s=>'./'+s),{
   windowsHide:true,stdio:'pipe',encoding:'utf8',
   maxBuffer:8*1024*1024,timeout:120000});
  if(p.error||p.status!==0)throw Error('OXLINT_CHANGED_SOURCE_FAILED');
  console.log('PASS: Oxlint checked '+files.length+' modified JS/TS source file(s).');
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
 runChangedLint().catch(e=>{console.error(e.message);process.exitCode=1;});
}
