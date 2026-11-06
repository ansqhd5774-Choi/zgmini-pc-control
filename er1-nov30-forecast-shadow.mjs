// ER1 November saved-forecast shadow A job, read-only. No provider calls,
// operational file writes, D1 writes, or live Writer/Controller changes.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const CONTROL='ansqhd5774-Choi/zgmini-pc-control';
export const PINNED_SOURCE='457fc8fe146e8a7a212ee0a68475945082ce30fb';
const PC_HOME=String.raw`E:\ZGmini\data\pc-writer`;
const DAYS=Array.from({length:30},(_,i)=>
  `2026-11-${String(i+1).padStart(2,'0')}`);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const stop=code=>{throw Error(code)};
const validDay=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&
  !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
function safeFile(file,max){
  try{const st=fs.lstatSync(file);
    return st.isFile()&&!st.isSymbolicLink()&&st.size>=2&&st.size<=max;
  }catch{return false}
}
function validBody(body,day){
  return body?.date===day&&['pre','after','notSupplied'].every(g=>
    Array.isArray(body[g])&&body[g].length<=5000);
}

function readPrivate(pcHome,day){
  const file=path.join(pcHome,'er1-input','nov30-forward-days',day+'.json');
  if(!fs.existsSync(file))return null;
  if(!safeFile(file,2_501_024))stop('ER1_FORECAST_PRIVATE_UNSAFE');
  let data;try{data=JSON.parse(fs.readFileSync(file,'utf8'))}
  catch{stop('ER1_FORECAST_PRIVATE_JSON_INVALID')}
  if(!validBody(data?.body,day)||!Number.isFinite(Date.parse(data?.storedAt)))
    stop('ER1_FORECAST_PRIVATE_SHAPE_INVALID');
  return {day,body:data.body,storedAt:data.storedAt};
}

function coreReader(pcHome){
  const file=path.join(pcHome,'storage','core.sqlite');
  if(!safeFile(file,Number.MAX_SAFE_INTEGER))
    stop('ER1_FORECAST_CORE_FILE_MISSING');
  return import('node:sqlite').then(({DatabaseSync})=>{
    const db=new DatabaseSync(file,{readOnly:true});
    db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=3000;');
    const stmt=db.prepare("SELECT body,stored_at FROM public_feed_snapshots_v1 WHERE kind='input' AND feed_key=? AND snapshot_key='current'");
    return {get(day){
      const r=stmt.get('release-calendar:earnings-api:'+day);
      if(!r)return null;
      let wrapper,body;try{
        wrapper=JSON.parse(r.body);
        if(wrapper.requestedDate!==day||typeof wrapper.text!=='string'||
          Buffer.byteLength(wrapper.text,'utf8')>2_000_000)
          stop('ER1_FORECAST_CORE_WRAPPER_INVALID');
        body=JSON.parse(wrapper.text);
      }catch{stop('ER1_FORECAST_CORE_SNAPSHOT_INVALID')}
      if(!validBody(body,day))stop('ER1_FORECAST_CORE_SHAPE_INVALID');
      return {day,body,storedAt:new Date(r.stored_at).toISOString()};
    },close(){db.close()}};
  });
}

export async function inspectSavedForecast({pcHome=PC_HOME,asOf=new Date()
  .toISOString().slice(0,10),privateGet,coreGet,adapter,score}={}){
  const report={schema:'ZGMINI_ER1_NOV_FORECAST_SHADOW_A_V1',
    status:'BLOCKED',code:'ER1_FORECAST_NOT_STARTED',asOf,dayCount:0,
    coreDays:0,privateDays:0,inputCalendarRows:0,futureSymbols:0,
    futureIssuers:0,scoreableIssuers:0,unscoreableIssuers:0,
    basis:{estimate:0,actual:0,mixed:0},star3Count:0,
    scoreBins:{under40:0,from40To60:0,from60To80:0,
      from80To97:0,from97To100:0},
    latestSourceStoredAt:null,scorerMethod:null,shadowOnly:true,
    historicalFilesRead:0,providerCalls:0,coreWrites:0,d1Writes:0,
    writerWrites:0,schedulerWrites:0,rawRowsPublic:0};
  if(!validDay(asOf)||asOf<'2026-11-01'||asOf>'2026-11-30'||
    !path.isAbsolute(pcHome)||typeof adapter!=='function'||
    typeof score!=='function'){
    report.code='ER1_FORECAST_INPUT_STOP';return report;
  }
  let db=null;
  try{
    if(!coreGet){
      db=await coreReader(pcHome);
      coreGet=db.get;
    }
    privateGet??=day=>readPrivate(pcHome,day);
    const savedDays=[];
    for(const day of DAYS){
      // Existing Nov 30 capture: 14 private days and 16 Core days. Keep
      // private-first precedence exactly as the verified November publisher.
      const p=privateGet(day),stored=p??coreGet(day);
      if(!stored)continue;
      if(stored.day!==day||!validBody(stored.body,day)||
        !Number.isFinite(Date.parse(stored.storedAt)))
        stop('ER1_FORECAST_SAVED_DAY_INVALID');
      savedDays.push(stored);
      if(p)report.privateDays++;else report.coreDays++;
    }
    report.dayCount=savedDays.length;
    if(savedDays.length!==30){report.status='PARTIAL';
      report.code='ER1_FORECAST_SAVED_DAYS_INCOMPLETE';return report;}
    const adapted=adapter({savedDays,historyBySymbol:{},asOf});
    if(adapted.coverage.savedDays!==30||
      !Number.isInteger(adapted.coverage.futureIssuers)||
      adapted.coverage.futureIssuers<1)
      stop('ER1_FORECAST_ADAPTER_COVERAGE_STOP');
    const scored=score(adapted.issuerRows,{asOf});
    if(scored.status!=='READY_SHADOW'||scored.previewOnly!==true||
      !Array.isArray(scored.rankings)||
      scored.coverage.scoreableIssuers!==scored.rankings.length)
      stop('ER1_FORECAST_SCORER_RESULT_STOP');
    report.inputCalendarRows=adapted.coverage.calendarRows;
    report.futureSymbols=adapted.coverage.futureSymbols;
    report.futureIssuers=adapted.coverage.futureIssuers;
    report.scoreableIssuers=scored.coverage.scoreableIssuers;
    report.unscoreableIssuers=adapted.coverage.futureIssuers-
      scored.coverage.scoreableIssuers;
    report.basis={estimate:scored.coverage.estimateOnly,
      actual:scored.coverage.actualOnly,mixed:scored.coverage.mixed};
    report.star3Count=scored.star3Count;
    report.latestSourceStoredAt=adapted.coverage.latestSourceStoredAt;
    report.scorerMethod=scored.method;
    for(const row of scored.rankings){
      if(!Number.isFinite(row.score)||row.score<0||row.score>100)
        stop('ER1_FORECAST_SCORE_OUT_OF_RANGE');
      const key=row.score>=97?'from97To100':row.score>=80?'from80To97':
        row.score>=60?'from60To80':row.score>=40?'from40To60':'under40';
      report.scoreBins[key]++;
    }
    if(Object.values(report.scoreBins).reduce((a,b)=>a+b,0)!==
      report.scoreableIssuers||report.basis.estimate+
      report.basis.actual+report.basis.mixed!==report.scoreableIssuers)
      stop('ER1_FORECAST_AGGREGATE_MISMATCH');
    report.status='PASS';report.code='ER1_FORECAST_SAVED_SHADOW_VERIFIED';
  }catch(e){report.status='BLOCKED';
    report.code=/^ER1_FORECAST_[A-Z0-9_]+$/.test(e?.message??'')?
      e.message:'ER1_FORECAST_READ_STOP';
  }finally{try{db?.close()}catch{}}
  return report;
}

function verifyIssue(event,env){
  if(env.GITHUB_REPOSITORY!==CONTROL||
    env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
    env.GITHUB_EVENT_NAME!=='issues'||
    env.GITHUB_EVENT_ACTION!=='opened'||event?.action!=='opened'||
    event.issue?.user?.login!=='ansqhd5774-Choi'||
    event.issue?.title!=='pc-er1-nov-forecast-shadow' ||
    !event.issue.labels?.some(x=>x.name==='pc-er1-approved'))
    stop('ER1_FORECAST_ISSUE_STOP');
  let req;try{req=JSON.parse(event.issue.body)}
  catch{stop('ER1_FORECAST_JSON_STOP')}
  const keys=['schema','operation','sourceSha','requestId','chatId'];
  if(!req||Array.isArray(req)||Object.keys(req).sort().join('|')!==
      keys.sort().join('|')||
    req.schema!=='ZGMINI_ER1_NOV_FORECAST_SHADOW_A_V1'||
    req.operation!=='read-only'||req.sourceSha!==PINNED_SOURCE||
    !req.requestId?.startsWith('pc-er1-forecast-')||
    !UUID.test(req.requestId.slice(16))||
    !req.chatId?.startsWith('chat-')||!UUID.test(req.chatId.slice(5)))
    stop('ER1_FORECAST_CONTRACT_STOP');
  return req;
}

function verifySource(workspace){
  const root=path.join(workspace,'source');
  const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,
    encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore'],
    timeout:10000}).trim();
  if(commit!==PINNED_SOURCE)stop('ER1_FORECAST_SOURCE_SHA_STOP');
  return root;
}

const resultFile=no=>`er1-nov-forecast-shadow-${no}.json`;
export async function execute({env=process.env}={}){
  let report={status:'BLOCKED',code:'ER1_FORECAST_NOT_STARTED',
    providerCalls:0,coreWrites:0,d1Writes:0,writerWrites:0};
  let output;
  try{
    if(process.platform!=='win32')stop('ER1_FORECAST_WINDOWS_ONLY');
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    verifyIssue(event,env);
    const issue=event.issue.number;
    if(!Number.isSafeInteger(issue)||issue<1||
      !path.isAbsolute(env.GITHUB_WORKSPACE))
      stop('ER1_FORECAST_WORKSPACE_STOP');
    output=path.join(env.GITHUB_WORKSPACE,resultFile(issue));
    const root=verifySource(env.GITHUB_WORKSPACE);
    const [{forecastRowsFromSaved},{scoreER1ForecastIssuers}]=await Promise.all([
      import(pathToFileURL(path.join(root,'lib',
        'market-calendar-er1-forecast-saved-adapter.mjs')).href),
      import(pathToFileURL(path.join(root,'lib',
        'market-calendar-er1-forecast-score.mjs')).href)]);
    report=await inspectSavedForecast({
      adapter:forecastRowsFromSaved,score:scoreER1ForecastIssuers});
  }catch(e){report.code=/^ER1_FORECAST_[A-Z0-9_]+$/.test(e?.message??'')?
      e.message:'ER1_FORECAST_UNEXPECTED_STOP';}
  if(output)fs.writeFileSync(output,JSON.stringify(report)+'\n',{flag:'wx'});
  console.log('ER1_FORECAST_SHADOW='+report.status+' CODE='+report.code);
  if(report.status!=='PASS')process.exitCode=1;
  return report;
}

export async function upload({env=process.env,fetcher=fetch}={}){
  let event;try{event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'))}
  catch{return}
  const no=event.issue?.number;
  if(env.GITHUB_REPOSITORY!==CONTROL||!Number.isSafeInteger(no)||
    !env.GITHUB_TOKEN||!path.isAbsolute(env.GITHUB_WORKSPACE))return;
  const file=path.join(env.GITHUB_WORKSPACE,resultFile(no));
  if(!safeFile(file,16_384))return;
  const report=JSON.parse(fs.readFileSync(file,'utf8'));
  const body='ER1 saved forecast shadow: **'+report.status+'** ('+
    report.code+')\n\n```json\n'+JSON.stringify(report,null,2)+'\n```';
  const reply=await fetcher('https://api.github.com/repos/'+CONTROL+'/issues/'+
    no+'/comments',{method:'POST',headers:{
      accept:'application/vnd.github+json',
      authorization:'Bearer '+env.GITHUB_TOKEN,
      'content-type':'application/json',
      'x-github-api-version':'2022-11-28'},
    body:JSON.stringify({body})});
  if(!reply.ok)stop('ER1_FORECAST_UPLOAD_STOP');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();else await execute();
}
