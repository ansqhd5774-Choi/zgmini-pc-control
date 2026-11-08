#!/usr/bin/env node
// Explicit one-shot Windows fixture proof; NEVER opens operational config.json.
// Separates test execution from sanitized create-only result delivery.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ACTOR,CONTROL_REPOSITORY} from './contract.mjs';

const TITLE='pc-writer-config-b-proof-once';
const RESULT='writer-config-b-proof-result.json';
const TESTS=['contract.test.mjs','config-two-key-patch.test.mjs',
 'installed-r6-guard.test.mjs','transaction.test.mjs','run.test.mjs',
 'report.test.mjs','proof-only.test.mjs'];
const stop=x=>{throw Error(x);};
const need=(ok,x)=>{if(!ok)stop(x);};
function authorize(event,env){
 need(env.GITHUB_REPOSITORY===CONTROL_REPOSITORY&&
  env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_ACTOR===ACTOR&&env.GITHUB_RUN_ATTEMPT==='1'&&
  event?.repository?.full_name===CONTROL_REPOSITORY&&
  event.repository.private===true&&event.sender?.login===ACTOR&&
  event.issue?.user?.login===ACTOR&&event.issue?.title===TITLE&&
  event.issue.labels?.some(x=>x.name==='pc-maintenance')&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0&&
  /^[0-9a-f]{40}$/i.test(env.GITHUB_SHA??''),'CONFIG_B_PROOF_AUTH_STOP');
}
function fixedDir(env){
 const root=path.join(env.GITHUB_WORKSPACE??'','config-b-proof-control');
 need(path.isAbsolute(root)&&fs.existsSync(path.join(root,'writer-config-b',
  'proof-only.mjs')),'CONFIG_B_PROOF_SOURCE_STOP');
 return root;
}
function resultPath(env){
 need(typeof env.RUNNER_TEMP==='string'&&path.isAbsolute(env.RUNNER_TEMP),
  'CONFIG_B_PROOF_TEMP_STOP');
 return path.join(env.RUNNER_TEMP,RESULT);
}
export function runFixtureProof(event,env,{execute=spawnSync}={}){
 authorize(event,env);
 need(process.platform==='win32','CONFIG_B_PROOF_WINDOWS_REQUIRED');
 const root=fixedDir(env);
 const args=['--test',...TESTS.map(p=>path.join(root,'writer-config-b',p))];
 const ran=execute(process.execPath,args,{cwd:root,encoding:'utf8',
  windowsHide:true,shell:false,timeout:180000,maxBuffer:256000});
 const passed=ran.status===0&&!ran.error&&!ran.signal;
 const report={schema:'ZGMINI_WRITER_CONFIG_B_WINDOWS_PROOF_V1',
  status:passed?'PASS':'FAIL',
  code:passed?'WINDOWS_TEMP_FIXTURE_TESTS_PASS':'WINDOWS_TEMP_FIXTURE_TESTS_FAIL',
  controlSha:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID??null,
  issueNumber:event.issue.number,testFiles:TESTS.length,
  configOperationalWrites:0,writerOperationalWrites:0,
  mode:'TEMP_FIXTURE_ONLY_NOT_PRODUCTION_INSTALL'};
 fs.writeFileSync(resultPath(env),JSON.stringify(report)+'\n',{flag:'wx'});
 return report;
}
async function compareReadback(url,headers,expected,fetchApi){
 try{const r=await fetchApi(url+'?ref=main',{method:'GET',headers});
  if(r.status!==200)return false;
  const body=await r.json();
  return body?.encoding==='base64'&&
   Buffer.from(String(body.content).replace(/\s/g,''),'base64').equals(Buffer.from(expected));
 }catch{return false;}
}
export async function reportProof(event,env,{fetchApi=fetch}={}){
 authorize(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
  /^\d{1,18}$/.test(env.GITHUB_RUN_ID??''),'CONFIG_B_PROOF_REPORT_AUTH_STOP');
 let raw;
 try{raw=JSON.parse(fs.readFileSync(resultPath(env),'utf8'));}catch{raw=null;}
 const valid=raw?.schema==='ZGMINI_WRITER_CONFIG_B_WINDOWS_PROOF_V1'&&
  ['PASS','FAIL'].includes(raw.status)&&raw.controlSha===env.GITHUB_SHA&&
  raw.code===(raw.status==='PASS'?'WINDOWS_TEMP_FIXTURE_TESTS_PASS':
   'WINDOWS_TEMP_FIXTURE_TESTS_FAIL')&&
  raw.issueNumber===event.issue.number&&raw.runId===env.GITHUB_RUN_ID&&
  raw.testFiles===TESTS.length&&raw.configOperationalWrites===0&&
  raw.writerOperationalWrites===0&&
  raw.mode==='TEMP_FIXTURE_ONLY_NOT_PRODUCTION_INSTALL';
 const safe={schema:'ZGMINI_WRITER_CONFIG_B_WINDOWS_PROOF_V1',
  status:valid?raw.status:'STATE_UNKNOWN',
  code:valid?raw.code:'RESULT_UNVERIFIED',
  issueNumber:event.issue.number,runId:env.GITHUB_RUN_ID,
  controlSha:env.GITHUB_SHA,testFiles:valid?TESTS.length:0,
  mode:'TEMP_FIXTURE_ONLY_NOT_PRODUCTION_INSTALL',
  configOperationalWrites:0,writerOperationalWrites:0};
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28',
  'content-type':'application/json','user-agent':'zgmini-config-b-proof'};
 const prefix=`results/writer-config-b-proof-${event.issue.number}-${env.GITHUB_RUN_ID}`;
 const outputs=[['json',JSON.stringify(safe,null,2)+'\n'],
  ['txt',Object.entries(safe).map(([k,v])=>`${k}=${v}`).join('\n')+'\n']];
 let verified=0,created=0;
 for(const [ext,bytes] of outputs){
  const url=`https://api.github.com/repos/${CONTROL_REPOSITORY}/contents/${prefix}.${ext}`;
  try{const r=await fetchApi(url,{method:'PUT',headers,body:JSON.stringify({
   message:'chore(pc): record Windows temporary config B fixture proof',
   content:Buffer.from(bytes).toString('base64')})});
   if(r.status===201)created++;}catch{/* No retry after ambiguous write. */}
  if(await compareReadback(url,headers,bytes,fetchApi))verified++;
 }
 const reported=verified===2?safe.status:'STATE_UNKNOWN';
 const body=`<!-- config-b-proof:${event.issue.number}:${env.GITHUB_RUN_ID} -->\n`+
  `Windows config-B **${reported}** — TEMP fixture only, operational config unchanged.\n`+
  `RESULT JSON/TXT readback: ${verified}/2; created: ${created}/2; `+
  `RUN_ID: ${env.GITHUB_RUN_ID}; NO_REEXECUTE\n`;
 const r=await fetchApi(`https://api.github.com/repos/${CONTROL_REPOSITORY}/issues/`+
  `${event.issue.number}/comments`,{method:'POST',headers,body:JSON.stringify({body})});
 need(r.status===201,'CONFIG_B_PROOF_COMMENT_STOP');
 return {status:reported,verified,created};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  if(process.argv[2]==='--run'){
   const r=runFixtureProof(event,env);
   process.stdout.write(`CONFIG_B_PROOF ${r.status} ${r.testFiles} TEST_FILES\n`);
   if(r.status!=='PASS')process.exitCode=1;
  }else if(process.argv[2]==='--report'){
   const r=await reportProof(event,env);
   process.stdout.write(`CONFIG_B_PROOF_REPORT ${r.status} ${r.verified}/2\n`);
   if(r.verified!==2)process.exitCode=1;
  }else stop('CONFIG_B_PROOF_MODE_STOP');
 }catch{
  process.stderr.write('CONFIG_B_PROOF_STOP_READ_ONLY_RECONCILE\n');
  process.exitCode=1;
 }
}
