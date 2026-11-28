// Source-only Gitleaks PR scan for the existing isolated Windows CI Runner.
// Official release ZIP and SHA-256 pinned from gitleaks/gitleaks v8.30.1.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {assessPublicSourceCi} from './public-source-ci-guard.mjs';
import {verifiedPublicMergeRange} from './public-ci-merge-tree.mjs';

export const GITLEAKS_VERSION='8.30.1';
export const GITLEAKS_ZIP_SHA256='d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e';
// Reserve a distinct result code for actual findings while treating all tool
// execution failures as hard errors. No findings, stderr or secrets are logged.
export const GITLEAKS_FINDINGS_EXIT_CODE=2;
const RULE_ID=/^[a-z][a-z0-9-]{0,79}$/;
// Parse ONLY the reporter's rule IDs; it must never surface the matched bytes,
// paths, line numbers or secret-bearing unparsed scanner output.
export function summarizeRuleOnlyOutput(output){
  if(typeof output!=='string'||output.length>20000)throw Error('GITLEAKS_REPORT_UNSAFE');
  const lines=output.trim().split(/\r?\n/);
  if(lines.length<1||lines.length>1000||lines.some(rule=>!RULE_ID.test(rule)))
    throw Error('GITLEAKS_REPORT_UNSAFE');
  return {findingCount:lines.length,ruleIds:[...new Set(lines)].sort()};
}

export function requireGitleaksClean(scan){
  if(!scan||scan.error||scan.signal||scan.status===null||scan.status===undefined)
    throw Error('GITLEAKS_EXECUTION_FAILED');
  if(scan.status===0)return true;
  if(scan.status===GITLEAKS_FINDINGS_EXIT_CODE)
    throw Error('GITLEAKS_FINDINGS_DETECTED');
  throw Error('GITLEAKS_SCAN_EXECUTION_FAILED');
}
const RELEASE_URL='https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_windows_x64.zip';
// Official v8.30.1 release asset digest, Linux x64 tar.gz.
export const GITLEAKS_LINUX_SHA256='551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb';
const LINUX_URL='https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz';
export function selectScanRelease(env,event,platform=process.platform,arch=process.arch){
  if(env?.RUNNER_OS==='Windows'&&platform==='win32'&&arch==='x64')
    return {url:RELEASE_URL,sha256:GITLEAKS_ZIP_SHA256,archive:'gitleaks.zip',exe:'gitleaks.exe',curl:'curl.exe',tar:'tar.exe'};
  if(env?.RUNNER_OS==='Linux'&&env.RUNNER_ARCH==='X64'&&platform==='linux'&&arch==='x64'&&
     assessPublicSourceCi({event,env}).status==='PASS')
    return {url:LINUX_URL,sha256:GITLEAKS_LINUX_SHA256,archive:'gitleaks.tar.gz',exe:'gitleaks',curl:'curl',tar:'tar'};
  throw Error('GITLEAKS_ISOLATED_EVENT_REQUIRED');
}
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
     ||!process.env.GITHUB_EVENT_PATH
     ||!process.env.RUNNER_TEMP)throw Error('GITLEAKS_ISOLATED_EVENT_REQUIRED');
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const release=selectScanRelease(process.env,event);
  const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
  const head=git(['rev-parse','HEAD']);
  const range=release.archive==='gitleaks.tar.gz'
    ?verifiedPublicMergeRange(event,process.env,git)
    :prCommitRange(event,head);
  git(['cat-file','-e',range.base+'^{commit}']);
  const folder=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP,'zgmini-gitleaks-'));
  try{
    const archive=path.join(folder,release.archive);
    run(release.curl,['--fail','--location','--silent','--show-error','--max-time','90',
      '--output',archive,release.url]);
    requireExactSha256(fs.readFileSync(archive),release.sha256);
    run(release.tar,['-xf',archive,'-C',folder]);
    const exe=path.join(folder,release.exe);
    if(!fs.existsSync(exe))throw Error('GITLEAKS_EXE_MISSING');
    // Never log findings, raw matches, reports or unredacted tool stderr.
    // The official reporter writes rule IDs only to captured stdout, never to
    // an Actions log or a file containing raw findings. Template is inert.
    const template=path.join(folder,'gitleaks-rule-only.tmpl');
    fs.writeFileSync(template,'{{range .}}{{.RuleID}}\n{{end}}',{flag:'wx',mode:0o600});
    const scan=spawnSync(exe,['git','--redact=100','--no-banner','--no-color',
      `--exit-code=${GITLEAKS_FINDINGS_EXIT_CODE}`,'--report-format=template',`--report-template=${template}`,'--report-path=-',`--log-opts=${range.base}..${range.head}`],{
      cwd:process.cwd(),windowsHide:true,stdio:'pipe',encoding:'utf8',
      maxBuffer:8*1024*1024});
    if(!scan.error&&!scan.signal&&scan.status===GITLEAKS_FINDINGS_EXIT_CODE){
      // Only validated rule identifiers and counts leave the scan process.
      const summary=summarizeRuleOnlyOutput(scan.stdout);
      console.log('GITLEAKS_FINDINGS_METADATA_ONLY count='+summary.findingCount+
        ' rules='+summary.ruleIds.join(','));
    }
    requireGitleaksClean(scan);
    console.log('PASS: Gitleaks source PR commit-range scan, details withheld.');
  }finally{
    fs.rmSync(folder,{recursive:true,force:true});
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
  scanPr();
}
