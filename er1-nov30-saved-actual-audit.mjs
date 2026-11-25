// Fixed A/read-only probe. Never calls EarningsAPI or mutates operational data.
// Inspect only stored 2026-11 day snapshots and existing historical actuals;
// return aggregate eligibility, not symbols, vendor rows, config or keys.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const CONTROL='ansqhd5774-Choi/zgmini-pc-control';
const PINNED_SOURCE='a6dd77d19ccfcb79ddcdd0b4a6f495ec3888e24a';
// The original 2026-11-06 *collector-ordered* digest, not the A audit's
// legacy ticker-alphabetical digest. Never re-date a raw observation.
const ORIGINAL_474_ASOF='2026-11-06';
const ORIGINAL_474_COLLECTOR_SHA='548d5c68e00af32d933a327b521e6b05a89f3bb37eac3ccb100e6af9b74ad255';
const PC_HOME=String.raw`E:\ZGmini\data\pc-writer`;
const DAYS=Array.from({length:30},(_,i)=>`2026-11-${String(i+1).padStart(2,'0')}`);
const GROUPS=['pre','after','notSupplied'];
const HISTORY_DIRS=['nov30-er1-batch20','nov30-er1-probe','nov30-er1-full',
  'dec31-symbol-probe','dec31-symbol-batch-a'];
const SYMBOL=/^[A-Z0-9][A-Z0-9.\-]{0,11}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha256=s=>createHash('sha256').update(s).digest('hex');
const validDay=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&
  !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const safeFile=(file,max)=>{try{const s=fs.lstatSync(file);
  return s.isFile()&&!s.isSymbolicLink()&&s.size>=2&&s.size<=max;
}catch{return false}};
const stop=code=>{throw Error(code)};

function calendarRows(body,day){
  if(body?.date!==day||!GROUPS.every(g=>Array.isArray(body[g])))return null;
  const rows=[];
  for(const g of GROUPS){
    if(body[g].length>5000)return null;
    for(const r of body[g]){
      if(!r||!SYMBOL.test(r.symbol)||typeof r.name!=='string'||!r.name.trim())
        return null;
      rows.push(r);
    }
  }
  return rows;
}

function storedHistory(input,symbol){
  for(const name of HISTORY_DIRS){
    const file=path.join(input,name,symbol+'.json');
    if(!fs.existsSync(file))continue;
    if(!safeFile(file,2_500_000))return {kind:'INVALID',rows:[]};
    try{
      const p=JSON.parse(fs.readFileSync(file,'utf8'));
      if(!Number.isFinite(Date.parse(p?.storedAt))||!Array.isArray(p.body)||
        p.body.length>1000)return {kind:'INVALID',rows:[]};
      const rows=[];let rejected=0;
      for(const r of p.body){
        if(r?.symbol!==symbol||!validDay(r.date)||
          !Object.hasOwn(r,'eps')||!Object.hasOwn(r,'revenue')||
          !(r.eps===null||typeof r.eps==='number'&&Number.isFinite(r.eps))||
          !(r.revenue===null||typeof r.revenue==='number'&&
            Number.isFinite(r.revenue)&&r.revenue>=0)){
          rejected++;continue;
        }
        rows.push({symbol,date:r.date,eps:r.eps,revenue:r.revenue});
      }
      if(p.validation===undefined&&rejected||p.validation!==undefined&&
        (p.validation?.validRows!==rows.length||p.validation?.rejectedRows!==rejected))
        return {kind:'INVALID',rows:[]};
      return {kind:'READ',rows,rejected};
    }catch{return {kind:'INVALID',rows:[]}}
  }
  return {kind:'MISSING',rows:[]};
}

export async function inspectSavedActual({pcHome=PC_HOME,
  asOf=new Date().toISOString().slice(0,10),readCore,score}={}){
  const result={schema:'ZGMINI_NOV30_SAVED_ACTUAL_READONLY_V1',status:'BLOCKED',
    code:'NOV30_SAVED_AUDIT_NOT_STARTED',asOf,dayCount:0,coreDays:0,
    privateDays:0,eventRows:0,scheduledSymbols:0,futureSymbols:0,
    candidateSetSha256:null,collectorOrderedCandidateSetSha256:null,
    original474CohortHashComparison:'NOT_EVALUATED',
    priorCalendarRowsBothActual:0,
    futureCalendarRowsBothActual:0,
    calendarForecastEPSNumberRows:0,calendarForecastEPSNullOrMissingRows:0,
    calendarForecastRevenueNumberRows:0,calendarForecastRevenueNullOrMissingRows:0,
    calendarRowsBothForecast:0,priorCalendarRowsBothForecast:0,
    futureCalendarRowsBothForecast:0,futureForecastInvalidRows:0,
    futureSymbolsWithEPSForecast:0,futureSymbolsWithRevenueForecast:0,
    futureSymbolsWithBothForecast:0,futureSymbolsWithoutBothForecast:0,
    historyFileSymbols:0,
    historyFilesInvalid:0,historyRowsPast:0,historyRowsRecent140d:0,
    historyEPSActualRows:0,
    historyRevenueActualRows:0,historyBothActualRows:0,
    futureSymbolsWithEPSActual:0,futureSymbolsWithRevenueActual:0,
    futureSymbolsWithBothActual:0,historyRecentLastReleaseSymbols:0,
    futureSymbolsWithRecentEPSandRevenueActual:0,scoreableIssuers:0,
    fullCohortVerified:false,previewOnly:true,
    providerCalls:0,coreWrites:0,d1Writes:0,schedulerWrites:0,
    existingFeedWrites:0,rawRowsPublic:0};
  if(!validDay(asOf)||!path.isAbsolute(pcHome)){
    result.code='NOV30_SAVED_AUDIT_INPUT_STOP';return result;
  }
  const input=path.join(pcHome,'er1-input');
  let db=null;
  try{
    if(!readCore){
      const {DatabaseSync}=await import('node:sqlite');
      const dbFile=path.join(pcHome,'storage','core.sqlite');
      if(safeFile(dbFile,Number.MAX_SAFE_INTEGER)){
        db=new DatabaseSync(dbFile,{readOnly:true});
        db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=3000;');
        const statement=db.prepare("SELECT body FROM public_feed_snapshots_v1 WHERE kind='input' AND feed_key=? AND snapshot_key='current'");
        readCore=day=>{
          const row=statement.get('release-calendar:earnings-api:'+day);
          if(!row)return null;
          const wrapper=JSON.parse(row.body);
          if(wrapper.requestedDate!==day||typeof wrapper.text!=='string'||
            Buffer.byteLength(wrapper.text)>2_000_000)return null;
          return JSON.parse(wrapper.text);
        };
      }else readCore=()=>null;
    }
    const future=new Set(),all=new Set(),firstFutureDate=new Map();
    const futureEPSForecast=new Set(),futureRevenueForecast=new Set();
    const futureBothForecast=new Set();
    for(const day of DAYS){
      const file=path.join(input,'nov30-forward-days',day+'.json');
      let rows=null,privateRead=false;
      if(safeFile(file,2_501_024)){
        try{
          const payload=JSON.parse(fs.readFileSync(file,'utf8'));
          if(Number.isFinite(Date.parse(payload?.storedAt)))
            rows=calendarRows(payload.body,day);
          privateRead=rows!==null;}catch{}
      }
      if(rows===null){
        try{rows=calendarRows(readCore(day),day)}catch{}
      }
      if(rows===null)continue;
      result.dayCount++;
      if(privateRead)result.privateDays++;else result.coreDays++;
      result.eventRows+=rows.length;
      for(const r of rows){
        all.add(r.symbol);
        if(day>asOf){
          future.add(r.symbol);
          const prior=firstFutureDate.get(r.symbol);
          if(!prior||day<prior)firstFutureDate.set(r.symbol,day);
        }
        const epsForecast=typeof r.epsEstimate==='number'&&
          Number.isFinite(r.epsEstimate);
        const revenueForecast=typeof r.revenueEstimate==='number'&&
          Number.isFinite(r.revenueEstimate)&&r.revenueEstimate>=0;
        const epsMissing=r.epsEstimate===null||r.epsEstimate===undefined;
        const revenueMissing=r.revenueEstimate===null||r.revenueEstimate===undefined;
        if(epsForecast)result.calendarForecastEPSNumberRows++;
        else if(epsMissing)result.calendarForecastEPSNullOrMissingRows++;
        if(revenueForecast)result.calendarForecastRevenueNumberRows++;
        else if(revenueMissing)result.calendarForecastRevenueNullOrMissingRows++;
        if(epsForecast&&revenueForecast){
          result.calendarRowsBothForecast++;
          if(day<asOf)result.priorCalendarRowsBothForecast++;
          else if(day>asOf)result.futureCalendarRowsBothForecast++;
        }
        if(day>asOf){
          if((!epsForecast&&!epsMissing)||(!revenueForecast&&!revenueMissing))
            result.futureForecastInvalidRows++;
          if(epsForecast)futureEPSForecast.add(r.symbol);
          if(revenueForecast)futureRevenueForecast.add(r.symbol);
          if(epsForecast&&revenueForecast)futureBothForecast.add(r.symbol);
        }
        if(typeof r.eps==='number'&&Number.isFinite(r.eps)&&
          typeof r.revenue==='number'&&Number.isFinite(r.revenue)&&r.revenue>=0){
          if(day<asOf)result.priorCalendarRowsBothActual++;
          else if(day>asOf)result.futureCalendarRowsBothActual++;
        }
      }
    }
    result.scheduledSymbols=all.size;
    result.futureSymbols=future.size;
    result.futureSymbolsWithEPSForecast=futureEPSForecast.size;
    result.futureSymbolsWithRevenueForecast=futureRevenueForecast.size;
    result.futureSymbolsWithBothForecast=futureBothForecast.size;
    result.futureSymbolsWithoutBothForecast=future.size-futureBothForecast.size;
    const symbols=[...future].sort();
    result.candidateSetSha256=sha256(JSON.stringify(symbols));
    // Exact selection order of original source:
    // selectFutureNovemberSymbols(): earliest scheduled date, then ticker.
    const collectorOrder=[...firstFutureDate].sort((a,b)=>
      a[1].localeCompare(b[1])||a[0].localeCompare(b[0]))
      .map(([symbol])=>symbol);
    result.collectorOrderedCandidateSetSha256=
      sha256(JSON.stringify(collectorOrder));
    if(asOf===ORIGINAL_474_ASOF&&result.dayCount===30)
      result.original474CohortHashComparison=
        result.collectorOrderedCandidateSetSha256===ORIGINAL_474_COLLECTOR_SHA?
          'MATCH':'MISMATCH';
    const issuerMap=new Map();
    const earliestRecent=new Date(Date.parse(asOf+'T00:00:00Z')-
      140*86400_000).toISOString().slice(0,10);
    for(const symbol of symbols){
      const historical=storedHistory(input,symbol);
      if(historical.kind==='INVALID'){
        result.historyFilesInvalid++;continue;
      }
      if(historical.kind==='MISSING')continue;
      result.historyFileSymbols++;
      const past=historical.rows.filter(r=>r.date<asOf);
      result.historyRowsPast+=past.length;
      result.historyRowsRecent140d+=past.filter(r=>r.date>=earliestRecent).length;
      const eps=past.filter(r=>typeof r.eps==='number').length;
      const rev=past.filter(r=>typeof r.revenue==='number').length;
      result.historyEPSActualRows+=eps;
      result.historyRevenueActualRows+=rev;
      result.historyBothActualRows+=past.filter(r=>typeof r.eps==='number'&&
        typeof r.revenue==='number').length;
      if(eps)result.futureSymbolsWithEPSActual++;
      if(rev)result.futureSymbolsWithRevenueActual++;
      if(eps&&rev)result.futureSymbolsWithBothActual++;
      const latest=past.reduce((a,r)=>r.date>a?r.date:a,'');
      if(latest>=earliestRecent){
        result.historyRecentLastReleaseSymbols++;
        if(eps&&rev)result.futureSymbolsWithRecentEPSandRevenueActual++;
      }
      // Actual scorer decides eligibility. These are existing files only.
      const issuerId=symbol==='GOOG'||symbol==='GOOGL'?'ALPHABET':
        /^BRK[.\-][AB]$/.test(symbol)?'BERKSHIRE':symbol;
      const group=issuerMap.get(issuerId)??[];
      group.push({symbol,past});issuerMap.set(issuerId,group);
    }
    const issuerRows=[...issuerMap].map(([issuerId,group])=>{
      group.sort((a,b)=>a.symbol.localeCompare(b.symbol));
      return {issuerId,tickers:group.map(r=>r.symbol),
        earningsSymbol:group[0].symbol,releases:group[0].past};
    });
    if(typeof score==='function'&&issuerRows.length){
      const scored=score(issuerRows,{asOf});
      result.scoreableIssuers=Number.isSafeInteger(scored?.coverage?.scoreableIssuers)?
        scored.coverage.scoreableIssuers:0;
    }
    result.status=result.dayCount===30&&result.historyFilesInvalid===0?'PASS':'PARTIAL';
    result.code=result.status==='PASS'?'NOV30_SAVED_AUDIT_VERIFIED':
      'NOV30_SAVED_AUDIT_PARTIAL';
  }catch{
    result.status='BLOCKED';result.code='NOV30_SAVED_AUDIT_READ_STOP';
  }finally{try{db?.close()}catch{}}
  return result;
}

export function validIssue(event,env){
  if(env.GITHUB_REPOSITORY!==CONTROL||env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
    env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
    event?.action!=='opened'||event.issue?.user?.login!=='ansqhd5774-Choi'||
    event.issue?.title!=='pc-er1-nov30-saved-actual-audit'||
    !event.issue.labels.some(x=>x.name==='pc-er1-approved'))
    stop('NOV30_SAVED_AUDIT_ISSUE_STOP');
  let req;try{req=JSON.parse(event.issue.body)}catch{stop('NOV30_SAVED_AUDIT_JSON_STOP')}
  const original474=req?.schema==='ZGMINI_ER1_NOV30_ORIGINAL_COHORT_A_V1';
  const keys=original474?
    ['schema','operation','sourceSha','requestId','chatId','originalIssueNumber']:
    ['schema','operation','sourceSha','requestId','chatId'];
  if(!req||Array.isArray(req)||Object.keys(req).sort().join('|')!==keys.sort().join('|')||
    (original474?
      req.schema!=='ZGMINI_ER1_NOV30_ORIGINAL_COHORT_A_V1'||
      req.operation!=='original-cohort-read-only'||req.originalIssueNumber!==474:
      req.schema!=='ZGMINI_ER1_NOV30_SAVED_ACTUAL_A_V1'||
      req.operation!=='read-only')||
    req.sourceSha!==PINNED_SOURCE||
    !req.requestId?.startsWith('pc-nov30-actual-')||
    !UUID.test(req.requestId.slice(16))||
    !req.chatId?.startsWith('chat-')||!UUID.test(req.chatId.slice(5)))
    stop('NOV30_SAVED_AUDIT_CONTRACT_STOP');
  return {...req,pinnedAsOf:original474?ORIGINAL_474_ASOF:null};
}

function verifySource(workspace){
  const root=path.join(workspace,'source');
  const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,
    encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore'],timeout:10000}).trim();
  if(head!==PINNED_SOURCE)stop('NOV30_SAVED_AUDIT_SOURCE_STOP');
  return path.join(root,'lib','market-calendar-er1-earnings-score.mjs');
}

const resultName=no=>`nov30-saved-audit-result-${no}.json`;
export async function execute({env=process.env}={}){
  let issue,output;
  let report={status:'BLOCKED',code:'NOV30_SAVED_AUDIT_NOT_STARTED',
    providerCalls:0,coreWrites:0,d1Writes:0,schedulerWrites:0};
  try{
    if(process.platform!=='win32')stop('NOV30_SAVED_AUDIT_WINDOWS_ONLY');
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    const request=validIssue(event,env);
    issue=event.issue.number;
    if(!Number.isSafeInteger(issue)||issue<1||!path.isAbsolute(env.GITHUB_WORKSPACE))
      stop('NOV30_SAVED_AUDIT_WORKSPACE_STOP');
    output=path.join(env.GITHUB_WORKSPACE,resultName(issue));
    const scoreFile=verifySource(env.GITHUB_WORKSPACE);
    const {scoreER1Issuers}=await import(pathToFileURL(scoreFile).href);
    report=await inspectSavedActual({
      asOf:request.pinnedAsOf??undefined,score:scoreER1Issuers});
  }catch(e){
    const code=e?.message;
    report.code=/^NOV30_SAVED_AUDIT_[A-Z_]+$/.test(code)?code:
      'NOV30_SAVED_AUDIT_UNEXPECTED_STOP';
  }
  if(output)fs.writeFileSync(output,JSON.stringify(report)+'\n',{flag:'wx'});
  console.log('NOV30_SAVED_AUDIT='+report.status+' CODE='+report.code);
  if(report.status!=='PASS')process.exitCode=1;
  return report;
}

export async function upload({env=process.env,fetcher=fetch}={}){
  let event;try{event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'))}catch{return}
  const no=event.issue?.number;
  if(env.GITHUB_REPOSITORY!==CONTROL||!Number.isSafeInteger(no)||
    !env.GITHUB_TOKEN||!path.isAbsolute(env.GITHUB_WORKSPACE))return;
  const file=path.join(env.GITHUB_WORKSPACE,resultName(no));
  if(!safeFile(file,16_384))return;
  const report=JSON.parse(fs.readFileSync(file,'utf8'));
  const body='November ER1 saved actual read-only: **'+report.status+'** ('+
    report.code+')\n\n```json\n'+JSON.stringify(report,null,2)+'\n```';
  const reply=await fetcher('https://api.github.com/repos/'+CONTROL+'/issues/'+no+'/comments',{
    method:'POST',headers:{accept:'application/vnd.github+json',
      authorization:'Bearer '+env.GITHUB_TOKEN,'content-type':'application/json',
      'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
  if(!reply.ok)stop('NOV30_SAVED_AUDIT_UPLOAD_STOP');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();else await execute();
}
