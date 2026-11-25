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
// Earliest original collector action began 2026-11-06 12:50:01 UTC
// (GitHub Actions 42220548112). Later raw input is not that observation.
const ORIGINAL_474_FIRST_RUN_START='2026-11-06T12:50:01.000Z';
const ORIGINAL_474_CUTOFF_MS=Date.parse(ORIGINAL_474_FIRST_RUN_START);
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

function storedHistory(input,symbol,folders=HISTORY_DIRS){
  for(const name of folders){
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
      return {kind:'READ',rows,rejected,storedAt:p.storedAt};
    }catch{return {kind:'INVALID',rows:[]}}
  }
  return {kind:'MISSING',rows:[]};
}

 
// For the fixed #474 2026-11-06 cohort, file existence is distinct from
// available numeric EPS/revenue actuals. Dates on/after the original as-of
// are not prior-report observations, regardless of when a file was stored.
// Caller has already checked raw file shape; this function does not read files.
export function summarizeOriginalPriorActualContent(history){
  const rows=history?.kind==='READ'&&Array.isArray(history.rows)?history.rows:[];
  let epsRows=0,revenueRows=0,bothRows=0;
  for(const r of rows){
    if(typeof r?.date!=='string'||r.date>=ORIGINAL_474_ASOF)continue;
    const eps=typeof r.eps==='number'&&Number.isFinite(r.eps);
    const revenue=typeof r.revenue==='number'&&Number.isFinite(r.revenue);
    if(eps)epsRows++;
    if(revenue)revenueRows++;
    if(eps&&revenue)bothRows++;
  }
  return {epsRows,revenueRows,bothRows};
}


// An additional local candidate is NOT an approved data source. Inspect only
// immediate siblings of the five fixed ER1 archives, never arbitrary PC paths.
// Return aggregate provenance signals, never directory names, tickers or raw.
export function inspectExtraEr1ArchiveCandidates(input,symbols){
  const out={schema:'ZGMINI_ER1_474_NEARBY_ARCHIVE_A_V1',
    status:'NOT_VERIFIED',code:'NEARBY_ARCHIVE_NOT_STARTED',
    scope:'ER1_INPUT_SIBLING_DIRECTORIES_ONLY',
    siblingDirectories:0,otherNamedDirectories:0,inspectedFolders:0,
    candidateFiles:0,shapeValidFiles:0,invalidFiles:0,
    extraOriginalSymbols:0,extraOriginalWithPriorBothActual:0,
    extraOriginalPreRunWithPriorBothActual:0,
    providerCalls:0,coreWrites:0,d1Writes:0,schedulerWrites:0};
  if(typeof input!=='string'||!path.isAbsolute(input)||
    !Array.isArray(symbols)||symbols.length>5000||
    symbols.some(x=>!SYMBOL.test(x))||new Set(symbols).size!==symbols.length){
    out.code='NEARBY_ARCHIVE_INPUT_INVALID';return out;
  }
  let entries;
  try{
    const root=fs.lstatSync(input);
    if(!root.isDirectory()||root.isSymbolicLink())throw Error('ROOT');
    entries=fs.readdirSync(input,{withFileTypes:true});
  }catch{out.code='NEARBY_ARCHIVE_ROOT_UNREADABLE';return out}
  if(entries.length>128){out.status='PARTIAL';out.code='NEARBY_ARCHIVE_ROOT_LIMIT';return out}
  const pattern=/^(?:nov30|dec31)-[a-z0-9-]{1,64}$/;
  const other=entries.filter(x=>x.isDirectory()&&!x.isSymbolicLink()&&!HISTORY_DIRS.includes(x.name));
  out.siblingDirectories=other.length;
  out.otherNamedDirectories=other.filter(x=>!pattern.test(x.name)).length;
  const matching=other.filter(x=>pattern.test(x.name));
  if(matching.length>32){out.status='PARTIAL';out.code='NEARBY_ARCHIVE_FOLDER_LIMIT';return out}
  const original=new Set(symbols),novel=new Set(),both=new Set(),earlyBoth=new Set();
  let partial=false;
  for(const ent of matching){
    const dir=path.join(input,ent.name);
    let names;
    try{
      const st=fs.lstatSync(dir);
      if(!st.isDirectory()||st.isSymbolicLink())throw Error('UNSAFE');
      names=fs.readdirSync(dir,{withFileTypes:true});
      if(names.length>4096)throw Error('TOO_MANY');
    }catch{partial=true;continue}
    out.inspectedFolders++;
    for(const entry of names){
      if(!entry.isFile()||entry.isSymbolicLink()||
        !entry.name.endsWith('.json'))continue;
      const symbol=entry.name.slice(0,-5);
      if(!original.has(symbol))continue;
      out.candidateFiles++;
      const h=storedHistory(input,symbol,[ent.name]);
      if(h.kind!=='READ'){out.invalidFiles++;continue}
      out.shapeValidFiles++;
      // Avoid promoting a duplicate of an already-inspected archive.
      if(storedHistory(input,symbol).kind!=='MISSING')continue;
      novel.add(symbol);
      const actual=summarizeOriginalPriorActualContent(h);
      if(actual.bothRows){
        both.add(symbol);
        if(Date.parse(h.storedAt)<=ORIGINAL_474_CUTOFF_MS)
          earlyBoth.add(symbol);
      }
    }
  }
  out.extraOriginalSymbols=novel.size;
  out.extraOriginalWithPriorBothActual=both.size;
  out.extraOriginalPreRunWithPriorBothActual=earlyBoth.size;
  out.status=partial?'PARTIAL':'PASS';
  out.code=partial?'NEARBY_ARCHIVE_SCAN_PARTIAL':'NEARBY_ARCHIVE_SCAN_COMPLETE';
  return out;
}

// A-grade: reconstruct the original date-pinned November candidate set only
// from stored historical SQLite rows and existing private files, never GET.
// If any historical input is unavailable, the original hash is NOT VERIFIED.
export async function inspectOriginalNov6InputVintage({
  pcHome=PC_HOME,readDatedCore
}={}){
  const r={
    schema:'ZGMINI_NOV30_474_INPUT_VINTAGE_A_V1',
    status:'NOT_VERIFIED',code:'NOV30_474_VINTAGE_NOT_STARTED',
    asOf:ORIGINAL_474_ASOF,cutoff:ORIGINAL_474_FIRST_RUN_START,
    validDays:0,privateDays:0,coreVintageDays:0,
    missingDays:0,invalidDays:0,eventRows:0,
    candidateSymbols:null,collectorOrderedCandidateSetSha256:null,
    original474CohortHashComparison:'NOT_EVALUATED',
    originalCohortCachedSymbols:null,originalCohortMissingSymbols:null,
    originalCohortInvalidFiles:null,
    originalCohortStoredBeforeRun:null,
    originalCohortStoredAfterRun:null,
    originalCohortCachedWithPriorEPSActual:null,
    originalCohortCachedWithPriorRevenueActual:null,
    originalCohortCachedWithPriorBothActual:null,
    originalCohortStoredBeforeRunWithPriorBothActual:null,
    originalCohortPriorBothActualRows:null,
    nearbyArchiveCandidateInventory:null,
    providerCalls:0,coreWrites:0,d1Writes:0,schedulerWrites:0
  };
  if(typeof pcHome!=='string'||!path.isAbsolute(pcHome)){
    r.code='NOV30_474_VINTAGE_PC_HOME_STOP';return r;
  }
  const input=path.join(pcHome,'er1-input');
  let db;
  try{
    if(readDatedCore!==undefined&&typeof readDatedCore!=='function'){
      r.code='NOV30_474_VINTAGE_READER_STOP';return r;
    }
    if(!readDatedCore){
      const dbFile=path.join(pcHome,'storage','core.sqlite');
      if(!safeFile(dbFile,Number.MAX_SAFE_INTEGER)){
        r.code='NOV30_474_VINTAGE_DB_NOT_FOUND';return r;
      }
      const {DatabaseSync}=await import('node:sqlite');
      db=new DatabaseSync(dbFile,{readOnly:true,timeout:1000});
      db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=1000;');
      // Only immutable YYYY-MM-DD input vintages. Never use "current" and
      // never select any row written after the original collector started.
      const stmt=db.prepare(
        "SELECT body,stored_at,snapshot_key FROM public_feed_snapshots_v1"+
        " WHERE kind='input' AND feed_key=?"+
        " AND snapshot_key GLOB '????-??-??' AND snapshot_key<=?"+
        " AND stored_at<=? ORDER BY stored_at DESC,snapshot_key DESC LIMIT 1");
      readDatedCore=day=>{
        const v=stmt.get('release-calendar:earnings-api:'+day,
          ORIGINAL_474_ASOF,ORIGINAL_474_CUTOFF_MS);
        if(!v)return null;
        if(typeof v.body!=='string'||Buffer.byteLength(v.body,'utf8')>2_501_024)
          throw Error('NOV30_474_VINTAGE_BODY_STOP');
        const wrapper=JSON.parse(v.body);
        if(wrapper?.requestedDate!==day||typeof wrapper.text!=='string'||
          Buffer.byteLength(wrapper.text,'utf8')>2_000_000)
          throw Error('NOV30_474_VINTAGE_WRAPPER_STOP');
        return {body:JSON.parse(wrapper.text),
          storedAt:v.stored_at,snapshotKey:v.snapshot_key};
      };
    }
    const firstDate=new Map();
    for(const day of DAYS){
      const file=path.join(input,'nov30-forward-days',day+'.json');
      let body=null,fromPrivate=false;
      // An unsafe or post-cutoff archive is NOT replaced by today's Core row.
      let filePresent=false;
      try{fs.lstatSync(file);filePresent=true}
      catch(error){
        if(error?.code!=='ENOENT'){r.invalidDays++;continue}
      }
      if(filePresent){
        if(!safeFile(file,2_501_024)){
          r.invalidDays++;continue;
        }
        try{
          const p=JSON.parse(fs.readFileSync(file,'utf8'));
          const at=Date.parse(p?.storedAt);
          if(!Number.isFinite(at)||at>Date.parse(ORIGINAL_474_FIRST_RUN_START)||
            at<Date.parse('2026-10-30T00:00:00Z')){
            r.invalidDays++;continue;
          }
          body=p.body;fromPrivate=true;
        }catch{r.invalidDays++;continue}
      }else{
        let v;
        try{v=readDatedCore(day)}catch{r.invalidDays++;continue}
        if(!v){r.missingDays++;continue}
        const at=Number(v.storedAt);
        if(!Number.isSafeInteger(at)||at< Date.parse('2026-10-30T00:00:00Z')||
          at>ORIGINAL_474_CUTOFF_MS||
          !validDay(v.snapshotKey)||v.snapshotKey>ORIGINAL_474_ASOF){
          r.invalidDays++;continue;
        }
        body=v.body;
      }
      const rows=calendarRows(body,day);
      if(!rows||r.eventRows+rows.length>5000){
        r.invalidDays++;continue;
      }
      r.validDays++;r.eventRows+=rows.length;
      if(fromPrivate)r.privateDays++;else r.coreVintageDays++;
      if(day>ORIGINAL_474_ASOF){
        for(const row of rows){
          const prior=firstDate.get(row.symbol);
          if(!prior||day<prior)firstDate.set(row.symbol,day);
        }
      }
    }
    if(r.validDays!==30||r.missingDays||r.invalidDays){
      r.code='NOV30_474_VINTAGE_INCOMPLETE';return r;
    }
    const symbols=[...firstDate].sort((a,b)=>
      a[1].localeCompare(b[1])||a[0].localeCompare(b[0]))
      .map(([symbol])=>symbol);
    r.candidateSymbols=symbols.length;
    r.collectorOrderedCandidateSetSha256=sha256(JSON.stringify(symbols));
    r.original474CohortHashComparison=
      r.collectorOrderedCandidateSetSha256===ORIGINAL_474_COLLECTOR_SHA?
        'MATCH':'MISMATCH';
    if(r.original474CohortHashComparison!=='MATCH'){
      r.status='NOT_VERIFIED';
      r.code='NOV30_474_HISTORICAL_COHORT_DIFFERENT';
      return r;
    }
    // Cohort membership is verified only on a matching immutable hash.
    // Read existing files only. A file today is not necessarily an old PIT row.
    let present=0,missing=0,invalid=0,before=0,after=0;
    let withEPS=0,withRevenue=0,withBoth=0,beforeWithBoth=0,bothRows=0;
    for(const symbol of symbols){
      const history=storedHistory(input,symbol);
      if(history.kind==='INVALID')invalid++;
      else if(history.kind==='MISSING')missing++;
      else{
        present++;
        const storedBefore=Date.parse(history.storedAt)<=ORIGINAL_474_CUTOFF_MS;
        if(storedBefore)before++;
        else after++;
        const actual=summarizeOriginalPriorActualContent(history);
        if(actual.epsRows>0)withEPS++;
        if(actual.revenueRows>0)withRevenue++;
        if(actual.bothRows>0){
          withBoth++;
          if(storedBefore)beforeWithBoth++;
        }
        bothRows+=actual.bothRows;
      }
    }
    r.originalCohortCachedWithPriorEPSActual=withEPS;
    r.originalCohortCachedWithPriorRevenueActual=withRevenue;
    r.originalCohortCachedWithPriorBothActual=withBoth;
    r.originalCohortStoredBeforeRunWithPriorBothActual=beforeWithBoth;
    r.originalCohortPriorBothActualRows=bothRows;
    r.nearbyArchiveCandidateInventory=inspectExtraEr1ArchiveCandidates(input,symbols);
    r.originalCohortCachedSymbols=present;
    r.originalCohortMissingSymbols=missing;
    r.originalCohortInvalidFiles=invalid;
    r.originalCohortStoredBeforeRun=before;
    r.originalCohortStoredAfterRun=after;
    r.status='PASS';r.code='NOV30_474_ORIGINAL_COHORT_HASH_VERIFIED';
  }catch{
    r.status='NOT_VERIFIED';r.code='NOV30_474_VINTAGE_READ_STOP';
  }finally{try{db?.close()}catch{}}
  return r;
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
  const vintage474=req?.schema==='ZGMINI_ER1_NOV30_ORIGINAL_VINTAGE_A_V1';
  const original474=vintage474||req?.schema==='ZGMINI_ER1_NOV30_ORIGINAL_COHORT_A_V1';
  const keys=original474?
    ['schema','operation','sourceSha','requestId','chatId','originalIssueNumber']:
    ['schema','operation','sourceSha','requestId','chatId'];
  if(!req||Array.isArray(req)||Object.keys(req).sort().join('|')!==keys.sort().join('|')||
    (original474?
      (vintage474?
        req.operation!=='original-vintage-read-only':
        req.schema!=='ZGMINI_ER1_NOV30_ORIGINAL_COHORT_A_V1'||
        req.operation!=='original-cohort-read-only')||
      req.originalIssueNumber!==474:
      req.schema!=='ZGMINI_ER1_NOV30_SAVED_ACTUAL_A_V1'||
      req.operation!=='read-only')||
    req.sourceSha!==PINNED_SOURCE||
    !req.requestId?.startsWith('pc-nov30-actual-')||
    !UUID.test(req.requestId.slice(16))||
    !req.chatId?.startsWith('chat-')||!UUID.test(req.chatId.slice(5)))
    stop('NOV30_SAVED_AUDIT_CONTRACT_STOP');
  return {...req,pinnedAsOf:original474?ORIGINAL_474_ASOF:null,
    inspectOriginalVintage:vintage474};
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
    if(request.inspectOriginalVintage)
      report.originalNov6InputVintage=await inspectOriginalNov6InputVintage();
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
