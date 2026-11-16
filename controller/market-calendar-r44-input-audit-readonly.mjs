// A-grade fixed-source audit. Reads only the already-saved November 2026
// CSV, calendar and published R44 local output. Never returns issuer data.
// No provider network, DB writes, D1 calls, schedule changes or dynamic paths.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const INPUT_KEY='market-calendar:deltascreener:2026-11-03:raw';
const OUTPUT_KEY='market-calendar:earnings-marketcap-r44-2026-11-public';
const DAY_PREFIX='release-calendar:earnings-api:';
const EXPECTED_SHA='dc3652b804a82857cbb4ddfcb2ad96ce22b0554c93afd2d9f53384859a744984';
const DAYS=Object.freeze(Array.from({length:30},(_,i)=>
 '2026-11-'+String(i+1).padStart(2,'0')));
const HEADER=['ticker','name','exchange','sector','industry','country','price','mktCap'];
const LISTED=new Set(['NASDAQ','NYSE','AMEX','NCM','NMS','NYQ','NGM','ASE','XNYS','CBOE']);
const TICKER=/^[A-Z0-9][A-Z0-9.\-]{0,11}$/;
// Calendar vendor accepts the full legacy 1..12 character symbol contract.
const EVENT_TICKER=/^[A-Z0-9.\-]{1,12}$/;
const DECIMAL=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const sha=s=>createHash('sha256').update(Buffer.from(s,'utf8')).digest('hex');
const positive=s=>typeof s==='string'&&DECIMAL.test(s.trim())&&
 Number.isFinite(Number(s))&&Number(s)>0?Number(s):null;
const safeDir=p=>{try{const s=fs.lstatSync(p);return s.isDirectory()&&!s.isSymbolicLink()}catch{return false}};
const safeFile=(p,max)=>{try{const s=fs.lstatSync(p);return s.isFile()&&!s.isSymbolicLink()&&s.size>1&&s.size<=max}catch{return false}};
const fail=code=>{throw Error(code)};

// Mirrors the fixed supplier CSV encoding and the active PC parser. No files
// are emitted and no raw cell is put in the operation report.
function csvRows(csv){
 if(typeof csv!=='string'||!csv.length||csv.length>2500000||csv.includes('\0'))
  fail('R44_CSV_SIZE_INVALID');
 const src=csv.charCodeAt(0)===0xFEFF?csv.slice(1):csv;
 const rows=[],row=[];let field='',quoted=false;
 for(let i=0;i<src.length;i++){
  const c=src[i];
  if(quoted){
   if(c==='"'&&src[i+1]==='"'){field+='"';i++}
   else if(c==='"')quoted=false;
   else field+=c;
  }else if(c==='"'){
   if(field!=='')fail('R44_CSV_QUOTES_INVALID');
   quoted=true;
  }else if(c===','){row.push(field);field=''}
  else if(c==='\n'){
   row.push(field);if(row.length>1||row[0]!=='')rows.push([...row]);
   row.length=0;field='';
  }else if(c==='\r'&&src[i+1]==='\n'){}
  else field+=c;
 }
 if(quoted)fail('R44_CSV_QUOTES_INVALID');
 if(field!==''||row.length){row.push(field);rows.push(row)}
 const header=rows.shift()??[];
 if(new Set(header).size!==header.length||HEADER.some(k=>!header.includes(k)))
  fail('R44_CSV_HEADER_INVALID');
 const pos=Object.fromEntries(HEADER.map(k=>[k,header.indexOf(k)]));
 for(const row of rows)if(row.length!==header.length)fail('R44_CSV_WIDTH_INVALID');
 return {rows,pos};
}
const issuer=t=>t==='GOOG'||t==='GOOGL'?'ALPHABET':
 /^BRK[.\-][AB]$/.test(t)?'BERKSHIRE':t;
const importance=cap=>cap>=200000000000?3:cap>=20000000000?2:1;

// Pure, deterministic audit, usable on mock rows without any PC access.
// "Candidates" are possible corrections only, never automatically applied.
export function analyzeR44ExistingInput(csv,calendarTickers){
 const {rows,pos}=csvRows(csv);
 if(!Array.isArray(calendarTickers)||calendarTickers.some(t=>!TICKER.test(t)))
  fail('R44_CALENDAR_TICKERS_INVALID');
 const scheduled=[...new Set(calendarTickers)].sort(),scheduledSet=new Set(scheduled);
 const strict=new Map(),rawCap=new Map();
 const strictSeen=new Set(),strictConflicts=new Set(),rawSeen=new Set(),rawConflicts=new Set();
 let invalidRows=0,nonListedRows=0,metadataRejectedWithCap=0;
 const p=(row,col)=>row[pos[col]]?.trim()??'';
 for(const row of rows){
  const t=p(row,'ticker'),cap=positive(p(row,'mktCap'));
  const metaOK=!!p(row,'name')&&!!p(row,'sector')&&!!p(row,'industry')&&
   positive(p(row,'price'))!==null;
  const validBase=TICKER.test(t)&&cap!==null;
  const listed=LISTED.has(p(row,'exchange').toUpperCase());
  if(validBase&&listed){
   if(rawSeen.has(t)){rawConflicts.add(t);rawCap.delete(t)}
   else{rawSeen.add(t);rawCap.set(t,cap)}
   if(!metaOK)metadataRejectedWithCap++;
  }
  if(!validBase||!metaOK){invalidRows++;continue}
  if(strictSeen.has(t)){strictConflicts.add(t);strict.delete(t);continue}
  strictSeen.add(t);
  if(!listed){nonListedRows++;continue}
  strict.set(t,cap);
 }
 for(const t of strictConflicts)strict.delete(t);
 for(const t of rawConflicts)rawCap.delete(t);
 const byIssuer=new Map(),conflicting=new Set();
 for(const t of scheduled){
  const cap=strict.get(t);if(cap===undefined)continue;
  const id=issuer(t),prior=byIssuer.get(id);
  if(prior&&prior.cap!==cap){
   conflicting.add(t);for(const priorTicker of prior.tickers)conflicting.add(priorTicker);
  }else if(prior)prior.tickers.push(t);
  else byIssuer.set(id,{cap,tickers:[t]});
 }
 const counts={one:0,two:0,three:0,missing:0,conflicting:0};
 const grades=new Map();
 for(const t of scheduled){
  const cap=strict.get(t);
  if(conflicting.has(t)){counts.conflicting++;grades.set(t,null)}
  else if(cap===undefined){counts.missing++;grades.set(t,null)}
  else{
   const g=importance(cap);grades.set(t,g);
   counts[g===1?'one':g===2?'two':'three']++;
  }
 }
 let metadataCandidates=0,aliasCandidates=0,maskedShareClassCandidates=0;
 for(const t of scheduled){
  if(strict.get(t)===undefined&&!strictConflicts.has(t)){
   if(rawCap.has(t))metadataCandidates++;
   else {
    // Only a strictly equivalent spelling for the *same* share class.
    const a=/^BRK([.\-])([AB])$/.exec(t);
    const counterpart=a?'BRK'+(a[1]==='.'?'-':'.')+a[2]:null;
    if(counterpart&&strict.has(counterpart)&&!rawCap.has(t))aliasCandidates++;
   }
  }else if(grades.get(t)!==null){
   const cap=strict.get(t),id=issuer(t);
   for(const [other,otherCap]of strict){
    if(other!==t&&!scheduledSet.has(other)&&issuer(other)===id&&otherCap!==cap){
     maskedShareClassCandidates++;break;
    }
   }
  }
 }
 return {
  rawRows:rows.length,validListedTickers:strict.size,invalidRows,nonListedRows,
  strictDuplicateTickerConflicts:strictConflicts.size,rawCapDuplicateConflicts:rawConflicts.size,
  metadataRejectedWithCap,
  calendarTickerCount:scheduled.length,coveredTickerCount:counts.one+counts.two+counts.three,
  counts,metadataCandidates,aliasCandidates,maskedShareClassCandidates,grades
 };
}

function parseSavedDay(text,day){
 if(typeof text!=='string'||!text.length||text.length>1000000)
  fail('R44_SAVED_DAY_TEXT_INVALID');
 let body;try{body=JSON.parse(text)}catch{fail('R44_SAVED_DAY_JSON_INVALID')}
 if(body?.date!==day)fail('R44_SAVED_DAY_DATE_INVALID');
 const tickers=[],seen=new Set();
 for(const bucket of ['pre','after','notSupplied']){
  if(!Array.isArray(body[bucket])||body[bucket].length>5000)
   fail('R44_SAVED_DAY_BUCKET_INVALID');
  for(const row of body[bucket]){
   if(!row||!EVENT_TICKER.test(row.symbol)||typeof row.name!=='string'||
      !row.name.trim()||row.name.length>200||seen.has(row.symbol))
    fail('R44_SAVED_DAY_ROW_INVALID');
   seen.add(row.symbol);tickers.push(row.symbol);
  }
 }
 return tickers;
}
function getBody(db,kind,key){
 const found=db.prepare("SELECT body FROM public_feed_snapshots_v1 WHERE kind=? AND feed_key=? AND snapshot_key='current'").get(kind,key);
 if(!found)return null;
 if(typeof found.body!=='string'||Buffer.byteLength(found.body,'utf8')>2500000)
  fail('R44_SQLITE_BODY_INVALID');
 try{return JSON.parse(found.body)}catch{fail('R44_SQLITE_JSON_INVALID')}
}
function privateArchive(pcHome,day){
 const dir=path.join(pcHome,'er1-input','nov30-forward-days');
 const file=path.join(dir,day+'.json');
 if(!safeDir(dir))return null;
 if(!fs.existsSync(file))return null;
 if(!safeFile(file,2001024))fail('R44_ARCHIVE_INVALID');
 let saved;try{saved=JSON.parse(fs.readFileSync(file,'utf8'))}
 catch{fail('R44_ARCHIVE_INVALID')}
 if(saved?.body?.date!==day||!Number.isFinite(Date.parse(saved?.storedAt)))
  fail('R44_ARCHIVE_INVALID');
 return JSON.stringify(saved.body);
}
export function inspectR44ExistingInputAudit(dataRoot,{openDb}={}){
 const result={status:'STATE_UNKNOWN',code:'R44_INPUT_AUDIT_UNAVAILABLE',
  schema:'R44_EXISTING_DATA_AUDIT_V1',sourceAsOf:'2026-11-03',
  sourceShaVerified:false,rawRows:null,validListedTickers:null,
  calendarTickerCount:null,coveredTickerCount:null,counts:null,
  invalidRows:null,nonListedRows:null,metadataRejectedWithCap:null,
  metadataCandidates:null,aliasCandidates:null,maskedShareClassCandidates:null,
  rawCapDuplicateConflicts:null,sqliteDays:0,archiveDays:0,
  localOutputAgrees:null,outputStatus:'NOT_READ',
  sqliteOpened:false,providerCalls:0,dbWrites:0,d1Writes:0,operationalWrites:0,
  rawExposed:false,formulaModified:false};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot)){
  result.code='R44_FIXED_ROOT_INVALID';return result;
 }
 const home=path.join(dataRoot,'pc-writer'),storage=path.join(home,'storage');
 const dbPath=path.join(storage,'core.sqlite');
 if(![dataRoot,home,storage].every(safeDir)||!safeFile(dbPath,Number.MAX_SAFE_INTEGER)){
  result.code='R44_FIXED_DB_UNAVAILABLE';return result;
 }
 let db;
 try{
  db=openDb?openDb(dbPath):new DatabaseSync(dbPath,{readOnly:true});
  result.sqliteOpened=true;
  db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=3000;');
  const input=getBody(db,'input',INPUT_KEY);
  if(typeof input?.text!=='string'||input.sha256!==EXPECTED_SHA||
     sha(input.text)!==EXPECTED_SHA){
   result.code='R44_PINNED_INPUT_UNVERIFIED';return result;
  }
  result.sourceShaVerified=true;
  const tickers=[];
  for(const day of DAYS){
   const saved=getBody(db,'input',DAY_PREFIX+day);
   let text=typeof saved?.text==='string'&&saved.requestedDate===day?saved.text:null;
   if(text)result.sqliteDays++;
   else{
    text=privateArchive(home,day);
    if(text)result.archiveDays++;
   }
   if(!text){result.code='R44_SAVED_MONTH_INCOMPLETE';return result}
   tickers.push(...parseSavedDay(text,day));
  }
  const a=analyzeR44ExistingInput(input.text,tickers);
  if(a.rawRows!==4894){
   result.code='R44_PINNED_INPUT_ROW_MISMATCH';return result;
  }
  for(const k of ['rawRows','validListedTickers','calendarTickerCount',
   'coveredTickerCount','counts','invalidRows','nonListedRows',
   'metadataRejectedWithCap','metadataCandidates','aliasCandidates',
   'maskedShareClassCandidates','rawCapDuplicateConflicts'])result[k]=a[k];
  const prior=getBody(db,'output',OUTPUT_KEY);
  if(prior){
   const values=prior.grades??{};
   result.localOutputAgrees=prior.calendarTickerCount===a.calendarTickerCount&&
    prior.coveredTickerCount===a.coveredTickerCount&&
    ['one','two','three','missing','conflicting'].every(k=>prior.counts?.[k]===a.counts[k])&&
    Object.keys(values).length===a.calendarTickerCount&&
    [...a.grades].every(([t,g])=>values[t]===g);
   result.outputStatus=result.localOutputAgrees?'MATCHED':'DIFFERS';
  }
  result.status='PASS';
  result.code='R44_EXISTING_INPUT_AUDITED';
 }catch(error){
  result.status='STATE_UNKNOWN';
  const code=String(error?.message??'');
  result.code=/^R44_[A-Z_]+$/.test(code)?code:'R44_READONLY_AUDIT_ERROR';
 }finally{try{db?.close()}catch{}}
 return result;
}
