// Source-only Gitleaks PR scan for the existing isolated Windows CI Runner.
// Official release ZIP and SHA-256 pinned from gitleaks/gitleaks v8.30.1.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';

export const GITLEAKS_VERSION='8.30.1';
export const GITLEAKS_ZIP_SHA256='d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e';
const RELEASE_URL='https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_windows_x64.zip';
const SHA=/^[0-9a-f]{40}$/;
export function prCommitRange(event,actualHead){
  const base=event?.pull_request?.base?.sha;
  const head=event?.pull_request?.head?.sha;
  if(!SHA.test(base??'')||!SHA.test(head??'')||head!==actualHead
     ||base===head)throw Error('GITLEAKS_PR_RANGE_INVALID');
  return {base,head};
}
export function requireExactSha256(content,expected){
  const actual=crypto.createHash('sha256').update(content).digest('hex');
  if(actual!==expected)throw Error('GITLEAKS_RELEASE_SHA256_MISMATCH');
  return true;
}
function run(command,args){
  const result=spawnSync(command,args,{windowsHide:true,stdio:'pipe',
    encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.error||result.status!==0)throw Error('GITLEAKS_SETUP_FAILED');
}
export function scanPr(){
  if(process.env.GITHUB_REPOSITORY!=='ansqhd5774-Choi/zgmini-pc-control'
     ||process.env.GITHUB_EVENT_NAME!=='pull_request'
     ||process.env.RUNNER_OS!=='Windows'
     ||!process.env.GITHUB_EVENT_PATH
     ||!process.env.RUNNER_TEMP)throw Error('GITLEAKS_ISOLATED_EVENT_REQUIRED');
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
  const head=git(['rev-parse','HEAD']);
  const range=prCommitRange(event,head);
  git(['cat-file','-e',range.base+'^{commit}']);
  const folder=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP,'zgmini-gitleaks-'));
  try{
    const archive=path.join(folder,'gitleaks.zip');
    run('curl.exe',['--fail','--location','--silent','--show-error','--max-time','90',
      '--output',archive,RELEASE_URL]);
    requireExactSha256(fs.readFileSync(archive),GITLEAKS_ZIP_SHA256);
    run('tar.exe',['-xf',archive,'-C',folder]);
    const exe=path.join(folder,'gitleaks.exe');
    if(!fs.existsSync(exe))throw Error('GITLEAKS_EXE_MISSING');
    // Never log findings, raw matches, reports or unredacted tool stderr.
    const scan=spawnSync(exe,['git','--redact=100','--no-banner','--no-color',
      '--exit-code=1',`--log-opts=${range.base}..${range.head}`],{
      cwd:process.cwd(),windowsHide:true,stdio:'pipe',encoding:'utf8',
      maxBuffer:8*1024*1024});
    if(scan.error||scan.status!==0)throw Error('GITLEAKS_SOURCE_SCAN_FAILED');
    console.log('PASS: Gitleaks source PR commit-range scan, details withheld.');
  }finally{
    fs.rmSync(folder,{recursive:true,force:true});
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
  scanPr();
}
