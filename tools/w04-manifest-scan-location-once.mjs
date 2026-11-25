import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const base='ef3c7e6b7da373c32a5b480a9b0ff98dba219635',head='7461c0c29ba66f9a6f06f5aafc5170b6ab9dec2e';
if(process.env.GITHUB_REPOSITORY!=='ansqhd5774-Choi/zgmini-pc-control'||process.env.RUNNER_OS!=='Windows'||process.env.COMPUTERNAME?.toUpperCase()!=='DESKTOP-N62L0NG')throw Error('ISOLATED_SOURCE_ONLY');
const dir=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP,'w04-scan-'));
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024});if(r.error||r.status!==0)throw Error('SETUP_FAILED');return r.stdout;};
try {
 const zip=path.join(dir,'gitleaks.zip');
 run('curl.exe',['--fail','--location','--silent','--show-error','--max-time','90','--output',zip,'https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_windows_x64.zip']);
 if(crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex')!=='d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e')throw Error('RELEASE_HASH_MISMATCH');
 run('tar.exe',['-xf',zip,'-C',dir]);
 const template=path.join(dir,'metadata.tmpl');
 fs.writeFileSync(template,'{{range .}}{{.Commit}}|{{.File}}|{{.RuleID}}|{{.StartLine}}\n{{end}}',{flag:'wx'});
 const scan=spawnSync(path.join(dir,'gitleaks.exe'),['git','--redact=100','--no-banner','--no-color','--exit-code=2','--report-format=template','--report-template='+template,'--report-path=-','--log-opts='+base+'..'+head],{windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024});
 if(scan.error||![0,2].includes(scan.status))throw Error('SCAN_FAILED');
 const allowed=new Set(['approvals/source-bundles/manifests/551640c3094738f7803d6a7f799098a55c21523c.json','approvals/source-bundles/360205596c575c0a91ad643eb88c032bcf53341833a0397a2d63da260d5e1c2b.json']);
 const lines=scan.stdout.trim().split(/\r?\n/).filter(Boolean);
 for(const line of lines){
  const [commit,file,rule,n,...rest]=line.split('|');
  const rel=file?.replace(/\\/g,'/');
  if(rest.length||!/^[a-f0-9]{40}$/.test(commit)||!allowed.has(rel)||!/^[a-z][a-z0-9-]{0,79}$/.test(rule)||!/^[1-9][0-9]{0,4}$/.test(n))throw Error('UNEXPECTED_FINDING_METADATA');
  const source=run('git',['show',commit+':'+rel]).split(/\r?\n/)[Number(n)-1];
  const digestField=/^\s*"[^"]+"\s*:\s*"[a-f0-9]{64}"[,]?\s*$/.test(source);
  console.log('FINDING_METADATA '+commit+':'+rel+':'+rule+':'+n+' exactHexDigestField='+digestField);
 }
 console.log('FINDING_COUNT='+lines.length);
 if(scan.status===2)process.exitCode=2;
} finally{fs.rmSync(dir,{recursive:true,force:true});}
