// A-grade, read-only PC diagnostic; extends the existing registered operation.
// No provider/network, publication, query mutations, or raw ticker/metric output.
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const DAYS=Object.freeze(Array.from({length:30},(_,i)=>
  `2026-11-${String(i+1).padStart(2,'0')}`));
const CALENDAR_KEY_PREFIX='release-calendar:earnings-api:';
const GROUPS=Object.freeze(['pre','after','notSupplied']);
const TICKER=/^[A-Z0-9][A-Z0-9.\-]{0,11}$/;
const MAX_DAY_BYTES=2_000_000;
const MAX_SCORES_BYTES=300_000;
const MAX_SYMBOL_HISTORY_BYTES=2_500_000;
// Bounded A/light (60 s): at most 128 known-archive entries, 16 MiB read.
const MAX_ACTUAL_ARCHIVE_ENTRIES=128;
const MAX_ACTUAL_ARCHIVE_BYTES=16_000_000;
const KNOWN_ACTUAL_DIRS=Object.freeze(['dec31-symbol-probe','dec31-symbol-batch-a']);
// A diagnostic only inspects file metadata here. Reading actual rows and
// deciding ER1 scoreability belongs to the approved PC collector/scorer.
const ER1_CACHE_DIRS=Object.freeze([
  'nov30-er1-full','nov30-er1-batch20','nov30-er1-probe',
  'dec31-symbol-probe','dec31-symbol-batch-a'
]);

function safeDir(dir){try{const stat=fs.lstatSync(dir);return stat.isDirectory()&&!stat.isSymbolicLink()}catch{return false}}
function safeFile(file,limit){try{const s=fs.lstatSync(file);return s.isFile()&&!s.isSymbolicLink()&&s.size>1&&s.size<=limit}catch{return false}}
const validDate=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\d$/.test(x)&&
  !Number.isNaN(Date.parse(x+'T00:00:00Z'))&&
  new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;

function parseCalendar(body,day){
  if(body?.date!==day||!GROUPS.every(g=>Array.isArray(body[g])))return null;
  const symbols=[],counts={valid:0,invalid:0};
  for(const group of GROUPS){
    if(body[group].length>5000)return null;
    for(const row of body[group]){
      if(!row||typeof row!=='object'||Array.isArray(row)||!TICKER.test(row.symbol)||
        typeof row.name!=='string'||!row.name.trim())counts.invalid++;
      else{symbols.push(row.symbol);counts.valid++}
    }
  }
  return {...counts,symbols};
}

function loadPrivate(file,day){
  if(!fs.existsSync(file))return {kind:'MISSING'};
  if(!safeFile(file,MAX_DAY_BYTES+1024))return {kind:'INVALID'};
  try{
    const payload=JSON.parse(fs.readFileSync(file,'utf8'));
    if(!Number.isFinite(Date.parse(payload?.storedAt)))return {kind:'INVALID'};
    const parsed=parseCalendar(payload.body,day);
    return parsed?{kind:'READ',...parsed}:{kind:'INVALID'};
  }catch{return {kind:'INVALID'}}
}

function loadCore(db,day){
  if(!db)return {kind:'MISSING'};
  let row;
  try{row=db.prepare("SELECT body,stored_at FROM public_feed_snapshots_v1 WHERE kind='input' AND feed_key=? AND snapshot_key='current'")
    .get(CALENDAR_KEY_PREFIX+day)}catch{return {kind:'INVALID'}}
  if(!row)return {kind:'MISSING'};
  try{
    const snapshot=JSON.parse(row.body);
    if(snapshot?.requestedDate!==day||typeof snapshot.text!=='string'||
      Buffer.byteLength(snapshot.text,'utf8')>MAX_DAY_BYTES)return {kind:'INVALID'};
    const parsed=parseCalendar(JSON.parse(snapshot.text),day);
    return parsed?{kind:'READ',...parsed}:{kind:'INVALID'};
  }catch{return {kind:'INVALID'}}
}

function scoreIndex(input){
  const file=path.join(input,'er1-public-display.json');
  if(!safeFile(file,MAX_SCORES_BYTES))return {state:'UNAVAILABLE',symbols:new Set()};
  try{
    const data=JSON.parse(fs.readFileSync(file,'utf8'));
    if(data?.status!=='READY_ER1_PUBLIC'||!validDate(data.asOf)||
      !Array.isArray(data.scores)||data.scores.length<1||data.scores.length>5000)
      return {state:'INVALID',symbols:new Set()};
    const symbols=new Set();
    for(const item of data.scores){
      if(!Array.isArray(item?.tickers)||item.tickers.length<1||
        typeof item.score!=='number'||!Number.isFinite(item.score)||item.score<0||item.score>100)
        return {state:'INVALID',symbols:new Set()};
      for(const ticker of item.tickers){
        if(!TICKER.test(ticker)||symbols.has(ticker))return {state:'INVALID',symbols:new Set()};
        symbols.add(ticker);
      }
    }
    return {state:'READY',symbols,asOf:data.asOf};
  }catch{return {state:'INVALID',symbols:new Set()}}
}

function knownActualFiles(input,novSymbols,asOf){
  const archives=new Set();
  const historicalMatches=new Set();
  let actualInputFiles=0,invalidActualFiles=0,entriesSeen=0,bytesRead=0;
  let inspectionPartial=false;
  for(const dir of KNOWN_ACTUAL_DIRS){
    const folder=path.join(input,dir);
    if(!safeDir(folder))continue;
    let files;try{files=fs.readdirSync(folder,{withFileTypes:true})}catch{continue}
    const remaining=MAX_ACTUAL_ARCHIVE_ENTRIES-entriesSeen;
    if(files.length>remaining){files=files.slice(0,Math.max(remaining,0));inspectionPartial=true}
    entriesSeen+=files.length;
    for(const entry of files){
      if(!entry.isFile()||!TICKER.test(entry.name.replace(/\.json$/,''))||
        !entry.name.endsWith('.json'))continue;
      const symbol=entry.name.slice(0,-5);
      const file=path.join(folder,entry.name);
      actualInputFiles++;
      if(!safeFile(file,MAX_SYMBOL_HISTORY_BYTES)){invalidActualFiles++;continue}
      const size=fs.lstatSync(file).size;
      if(bytesRead+size>MAX_ACTUAL_ARCHIVE_BYTES){inspectionPartial=true;break}
      bytesRead+=size;
      let payload;try{payload=JSON.parse(fs.readFileSync(file,'utf8'))}catch{invalidActualFiles++;continue}
      if(!Array.isArray(payload?.body)||payload.body.length>1000){invalidActualFiles++;continue}
      archives.add(symbol);
      if(novSymbols.has(symbol)&&payload.body.some(row=>row?.symbol===symbol&&
        validDate(row.date)&&row.date<asOf&&
        (typeof row.eps==='number'&&Number.isFinite(row.eps)||
        typeof row.revenue==='number'&&Number.isFinite(row.revenue)&&row.revenue>=0)))
        historicalMatches.add(symbol);
    }
    if(inspectionPartial)break;
  }
  return {knownActualArchiveSymbols:archives.size,actualInputFiles,
    candidateHistoricalMatches:historicalMatches.size,invalidActualFiles,
    actualArchiveInspectionPartial:inspectionPartial};
}

function inspectFutureCandidateCache(input,symbols){
  const folders=ER1_CACHE_DIRS.map(name=>path.join(input,name))
    .filter(safeDir);
  let cached=0,invalid=0,missing=0;
  for(const symbol of symbols){
    let present=false,validMetadata=false;
    for(const folder of folders){
      const file=path.join(folder,symbol+'.json');
      if(!fs.existsSync(file))continue;
      present=true;
      if(safeFile(file,MAX_SYMBOL_HISTORY_BYTES)){validMetadata=true;break}
    }
    if(validMetadata)cached++;
    else if(present)invalid++;
    else missing++;
  }
  return {futureCachedFileSymbols:cached,futureInvalidFileSymbols:invalid,
    futureMissingFileSymbols:missing};
}

// The `dataRoot` value comes solely from the Controller's configured root.
// No request-supplied path or day selection is accepted.
export function inspectER1NovemberAvailability(dataRoot,{clock=Date.now,openDb}={}){
  const report={status:'BLOCKED',code:'ER1_NOV30_INPUT_MISSING',
    schema:'ER1_NOV30_AVAILABILITY_READONLY_V1',
    targetMonth:'2026-11',expectedDayCount:30,verifiedDayCount:0,
    coreReusedDayCount:0,privateDayCount:0,missingDayCount:0,
    invalidDayCount:0,calendarEventRows:0,invalidVendorRows:0,
    uniqueScheduledSymbols:0,priorScoreSnapshotState:'UNAVAILABLE',
    priorScoreAsOf:null,priorScoreJoinSymbols:0,
    knownActualArchiveSymbols:0,actualInputFiles:0,
    candidateHistoricalMatches:0,invalidActualFiles:0,
    actualArchiveInspectionPartial:false,
    futureCandidateAsOfUtc:null,futureCandidateSymbols:0,
    futureCachedFileSymbols:0,futureInvalidFileSymbols:0,
    futureMissingFileSymbols:0,futureActualContentsVerified:false,
    actualEligibilityVerified:false,scoreCalculationPerformed:false,
    calendarIsNotActualHistory:true,sqliteOpened:false,
    providerCalls:0,dbWrites:0,d1Writes:0,operationalWrites:0};
  if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot)){
    report.code='ER1_NOV30_DATA_ROOT_INVALID';return report;
  }
  const home=path.join(dataRoot,'pc-writer'),input=path.join(home,'er1-input');
  const privateDir=path.join(input,'nov30-forward-days');
  if(![dataRoot,home,input,privateDir].every(safeDir))return report;
  const storage=path.join(home,'storage');
  const dbPath=path.join(storage,'core.sqlite');
  const opener=openDb??(file=>{
    const db=new DatabaseSync(file,{readOnly:true});
    db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=3000;');return db;
  });
  let db=null;
  if(safeDir(storage)&&safeFile(dbPath,Number.MAX_SAFE_INTEGER)){
    try{db=opener(dbPath);report.sqliteOpened=true}catch{}
  }
  try{
    const tickerSet=new Set();
    const asOf=new Date(clock()).toISOString().slice(0,10);
    const futureSymbols=new Set();
    report.futureCandidateAsOfUtc=asOf;
    for(const day of DAYS){
      const privateResult=loadPrivate(path.join(privateDir,day+'.json'),day);
      const coreResult=privateResult.kind==='READ'?null:loadCore(db,day);
      const selected=privateResult.kind==='READ'?privateResult:
        coreResult.kind==='READ'?coreResult:
        privateResult.kind==='INVALID'?privateResult:coreResult;
      if(selected.kind!=='READ'){
        if(selected.kind==='MISSING')report.missingDayCount++;
        else report.invalidDayCount++;
        continue;
      }
      report.verifiedDayCount++;
      if(privateResult.kind==='READ')report.privateDayCount++;
      else report.coreReusedDayCount++;
      report.calendarEventRows+=selected.valid+selected.invalid;
      report.invalidVendorRows+=selected.invalid;
      for(const symbol of selected.symbols){
        tickerSet.add(symbol);
        // Same predicate as the ER1 November future-only collector.
        if(day>asOf)futureSymbols.add(symbol);
      }
    }
    report.uniqueScheduledSymbols=tickerSet.size;
    report.futureCandidateSymbols=futureSymbols.size;
    Object.assign(report,inspectFutureCandidateCache(input,futureSymbols));
    const scored=scoreIndex(input);
    report.priorScoreSnapshotState=scored.state;
    report.priorScoreAsOf=scored.asOf??null;
    for(const ticker of tickerSet)if(scored.symbols.has(ticker))report.priorScoreJoinSymbols++;
    Object.assign(report,knownActualFiles(input,tickerSet,asOf));
    const complete=report.verifiedDayCount===30&&report.invalidVendorRows===0&&
      report.missingDayCount===0&&report.invalidDayCount===0;
    report.status=complete?'PASS':report.verifiedDayCount?'PARTIAL':'BLOCKED';
    report.code=complete?'ER1_NOV30_AVAILABILITY_READONLY':
      'ER1_NOV30_AVAILABILITY_PARTIAL';
  }catch(error){
    report.status='BLOCKED';
    report.code='ER1_NOV30_AVAILABILITY_UNEXPECTED_STOP';
  }finally{try{db?.close()}catch{}}
  return report;
}
