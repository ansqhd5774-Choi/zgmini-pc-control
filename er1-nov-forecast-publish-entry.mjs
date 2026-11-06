// Fixed ER1 November saved-forecast B job. Never calls a vendor endpoint.
// Production integration candidate; not installed until the control PR is merged.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {runNovemberForecastB} from './er1-nov-forecast-b-core.mjs';

const CONTROL='ansqhd5774-Choi/zgmini-pc-control';
const SOURCE='ansqhd5774-Choi/zgmini';
export const PINNED_SOURCE='2a232382207f1165291546952f194c5e3e075670';
const PUBLIC_KEY='market-calendar:earnings-nov2026-er1-score-public';
const PC_HOME=String.raw`E:\ZGmini\data\pc-writer`;
const MANIFEST='ER1_NOV_FORECAST_B_APPROVAL.json';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA40=/^[a-f0-9]{40}$/;
const stop=code=>{throw Error(code)};
const hashBlob=data=>createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
const exact=(obj,fields)=>!!obj&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join('|')===fields.slice().sort().join('|');

export function validateRequest(event,env){
  if(env.GITHUB_REPOSITORY!==CONTROL||env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
   env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
   event?.action!=='opened'||event.issue?.user?.login!=='ansqhd5774-Choi'||
   event.issue?.title!=='pc-er1-nov-forecast-publish'||
   !event.issue?.labels?.some(x=>x.name==='pc-er1-approved'))
    stop('ER1_NOV_FORECAST_B_ISSUE_STOP');
  let req;try{req=JSON.parse(event.issue.body)}catch{stop('ER1_NOV_FORECAST_B_JSON_STOP')}
  if(!exact(req,['schema','operation','sourceSha','requestId','chatId','month'])||
   req.schema!=='ZGMINI_ER1_NOV_FORECAST_B_V1'||
   req.operation!=='saved-forecast-publish'||
   req.sourceSha!==PINNED_SOURCE||req.month!=='2026-11'||
   typeof req.requestId!=='string'||!req.requestId.startsWith('pc-er1-nov-forecast-')||
   !UUID.test(req.requestId.slice('pc-er1-nov-forecast-'.length))||
   typeof req.chatId!=='string'||!req.chatId.startsWith('chat-')||
   !UUID.test(req.chatId.slice(5)))
   stop('ER1_NOV_FORECAST_B_REQUEST_STOP');
  return req;
}

export function validateApproval(m,sourceSha=PINNED_SOURCE){
  const paths=['lib/market-calendar-er1-forecast-score.mjs',
    'lib/market-calendar-er1-forecast-saved-adapter.mjs',
    'lib/market-calendar-er1-forecast-publish-bridge.mjs',
    'lib/market-calendar-er1-public-display.mjs',
    'scripts/pc-writer/market-calendar-nov30-er1-probe-publish.mjs'];
  if(!SHA40.test(sourceSha)||m?.schema!=='ZGMINI_ER1_NOV_FORECAST_B_APPROVAL_V1'||
   m.scope!=='ER1_NOV_SAVED_FORECAST_D1_ONLY'||
   m.approvalState!=='APPROVED_B_NOV2026_FORECAST_ONLY'||
   m.sourceRepository!==SOURCE||m.sourceSha!==sourceSha||
   m.month!=='2026-11'||m.outputKey!==PUBLIC_KEY||
   m.maxProviderCalls!==0||m.allowCoreWrites!==false||
   m.maxD1Writes!==1||m.allowExistingFeedWrites!==false||
   m.allowSchedulerChanges!==false||m.allowRawRowsPublic!==false||
   !Array.isArray(m.files)||m.files.length!==paths.length||
   new Set(m.files.map(f=>f.path)).size!==paths.length||
   paths.some(p=>!m.files.some(f=>f.path===p))||
   m.files.some(f=>!SHA40.test(f.blobSha)))
   stop('ER1_NOV_FORECAST_B_APPROVAL_STOP');
  return m;
}

export function verifySource(root,m,{getHead}={}){
  const sha=getHead?getHead(root):execFileSync('git',['rev-parse','HEAD'],{
    cwd:root,encoding:'utf8',windowsHide:true,timeout:10000}).trim();
  if(sha!==m.sourceSha)stop('ER1_NOV_FORECAST_B_SOURCE_STOP');
  for(const entry of m.files){
    const file=path.join(root,...entry.path.split('/'));
    let st;try{st=fs.lstatSync(file)}catch{stop('ER1_NOV_FORECAST_B_FILE_MISSING')}
    if(!st.isFile()||st.isSymbolicLink()||st.size<2||st.size>1_000_000||
      hashBlob(fs.readFileSync(file))!==entry.blobSha)
      stop('ER1_NOV_FORECAST_B_SOURCE_HASH_STOP');
  }
  return root;
}

export const resultName=number=>{
  if(!Number.isSafeInteger(number)||number<1)stop('ER1_NOV_FORECAST_B_NUMBER_STOP');
  return 'er1-nov-forecast-b-'+number+'.json';
};

// Exactly one approved job. Source code/config/network clients come from the
// existing pinned checkout and already-approved local PC configuration.
export async function execute({env=process.env}={}){
  let report={schema:'ZGMINI_ER1_NOV_FORECAST_B_RESULT_V1',status:'BLOCKED',
    code:'ER1_NOV_FORECAST_B_NOT_STARTED',providerCalls:0,coreWrites:0,
    schedulerWrites:0,rawRowsPublic:0,d1Writes:0};
  let output,sideEffectAttempted=false;
  try{
    if(process.platform!=='win32')stop('ER1_NOV_FORECAST_B_WINDOWS_ONLY');
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    if(!path.isAbsolute(env.GITHUB_WORKSPACE))stop('ER1_NOV_FORECAST_B_WORKSPACE_STOP');
    output=path.join(env.GITHUB_WORKSPACE,resultName(event.issue.number));
    // Even a rejected request leaves a minimal status report for the Issue.
    const req=validateRequest(event,env);
    const approvalPath=path.join(env.GITHUB_WORKSPACE,'control',MANIFEST);
    const m=validateApproval(JSON.parse(fs.readFileSync(approvalPath,'utf8')));
    const src=verifySource(path.join(env.GITHUB_WORKSPACE,'source'),m);
    const imp=p=>import(pathToFileURL(path.join(src,...p.split('/'))).href);
    const [{loadSavedNovemberDays},{forecastRowsFromSaved},
      {scoreER1ForecastIssuers},{makeER1PublicDisplay},
      {prepareForecastMonth,stageForecastMonth,publishForecastMonth},
      {saveNovemberER1Derived,syncNovemberER1D1,getRemote,NOV2026_ER1_PUBLIC_KEY}]=
      await Promise.all([
        import('./er1-nov30-forecast-shadow.mjs'),
        imp('lib/market-calendar-er1-forecast-saved-adapter.mjs'),
        imp('lib/market-calendar-er1-forecast-score.mjs'),
        imp('lib/market-calendar-er1-public-display.mjs'),
        imp('lib/market-calendar-er1-forecast-publish-bridge.mjs'),
        imp('scripts/pc-writer/market-calendar-nov30-er1-probe-publish.mjs')]);
    if(NOV2026_ER1_PUBLIC_KEY!==PUBLIC_KEY)stop('ER1_NOV_FORECAST_B_PUBLIC_KEY_STOP');
    const outputDir=path.join(PC_HOME,'er1-input','nov30-forecast-derived');
    // Remote resolver reuses existing config.source approval, no new key path.
    const {remote,core}=await getRemote(PC_HOME);
    sideEffectAttempted=true; // local derived save can begin below
    report=await runNovemberForecastB({
      approval:m,sourceSha:req.sourceSha,
      // The operational calendar and page dates are Asia/Seoul dates.
      asOf:new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10),
      loadSavedNovemberDays,adapter:forecastRowsFromSaved,
      scorer:scoreER1ForecastIssuers,publicSerializer:makeER1PublicDisplay,
      prepareForecastMonth,stageForecastMonth,publishForecastMonth,
      saveDerived:body=>saveNovemberER1Derived(outputDir,body,1_000_000),
      syncD1:{publicKey:PUBLIC_KEY,run:syncNovemberER1D1},
      remote,core
    });
    report.requestId=req.requestId;
  }catch(e){
    report.status=sideEffectAttempted?'STATE_UNKNOWN':'BLOCKED';
    report.code=/^(?:ER1_(?:NOV_)?FORECAST|NOV30_ER1)_[A-Z0-9_]+$/.test(
      e?.message??'')?e.message:'ER1_NOV_FORECAST_B_UNEXPECTED_STOP';
  }
  try{if(output)fs.writeFileSync(output,JSON.stringify(report)+'\n',{flag:'wx'})}
  catch{process.stderr.write('ER1_NOV_FORECAST_B_REPORT_STOP\n')}
  console.log('ER1_NOV_FORECAST_B='+report.status+' CODE='+report.code);
  if(report.status!=='PASS')process.exitCode=1;
  return report;
}

export async function upload({env=process.env,fetcher=fetch}={}){
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  if(env.GITHUB_REPOSITORY!==CONTROL||!env.GITHUB_TOKEN||
    !Number.isSafeInteger(event.issue?.number)||!path.isAbsolute(env.GITHUB_WORKSPACE))return;
  const file=path.join(env.GITHUB_WORKSPACE,resultName(event.issue.number));
  if(!fs.existsSync(file))return;
  const report=JSON.parse(fs.readFileSync(file,'utf8'));
  const body='ER1 November forecast B: **'+report.status+'** ('+report.code+
    ')\n\n```json\n'+JSON.stringify(report,null,2)+'\n```';
  const response=await fetcher('https://api.github.com/repos/'+CONTROL+
    '/issues/'+event.issue.number+'/comments',{method:'POST',headers:{
      accept:'application/vnd.github+json',authorization:'Bearer '+env.GITHUB_TOKEN,
      'content-type':'application/json','x-github-api-version':'2022-11-28'},
      body:JSON.stringify({body})});
  if(!response.ok)stop('ER1_NOV_FORECAST_B_UPLOAD_STOP');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();else await execute();
}
