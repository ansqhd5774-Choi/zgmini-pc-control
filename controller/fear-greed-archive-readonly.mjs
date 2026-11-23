import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const CORE_TASK = 'ZGMINI-PC-Local-Core';
const MAX_LAUNCHER_BYTES = 131072;
const MAX_LEDGER_BYTES = 65536;
const MAX_SIDECAR_SOURCE_BYTES = 131072;
const MAX_SIDECAR_FILES = 64;
const MAX_LEDGER_FILES = 12;
// Read-only diagnostic provenance: the installed Sidecar was upgraded after R7.
// A known digest permits bounded static attribution, NOT operational execution,
// source approval, or skipping the Sidecar's own protection gate.
const SIDECAR_SOURCE_EXPECTED = Object.freeze({
  'archive-run.mjs': Object.freeze([
    '04770152c01d4584fe3ee1b0166fc718718656b95cb3639680a6f23fe75191de', // R7
    'e6966138c99d8bf45382e7aad2f00082102dd0ac4cd1d689ffee71fa2098e892', // observed 11/06
    'ce07af0b5e8d17625644e204f2815c1f754aff2468bc5434ac13c0dadcecd907', // current R10
  ]),
  'run-original-then-archive.vbs': '9d5bc3429cd74813207cfc393eb04eff11a78106096964b80bf7833440385b7c',
});
function pinnedSidecarSourceMatch(actual,expected){
 const allowed=Array.isArray(expected)?expected:[expected];
 return allowed.some(sha=>typeof sha==='string'&&/^[0-9a-f]{64}$/.test(sha)&&sha===actual);
}
const LEDGER_NAME = /^(?=[a-z0-9_.-]{1,100}\.json$)(?=.*(?:last-run|status|ledger|checkpoint|result|report))[a-z0-9_.-]+\.json$/i;
const ALLOWED_ROOTS = ['e:\\zgmini\\data\\pc-writer\\', 'e:\\zgmini\\projects\\'];
const safeIso = value => typeof value==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString()===value ? value : null;
const safeStatus = value => typeof value==='string' && /^[A-Z_a-z]{1,32}$/.test(value) ? value : null;
// Ledger values are untrusted: a shape check alone can pass credential-like strings.
const KNOWN_LEDGER_STATUSES = new Set([
  'PASS','FAIL','FAILED','ERROR','BLOCKED','SKIPPED','UNCHANGED','RUNNING','STARTED',
  'COMPLETE','COMPLETED','VERIFIED','PENDING','UNKNOWN','SUCCESS','SUCCEEDED',
  'READ','READY','PARTIAL','STOPPED','NOT_FOUND','NO_DATA',
]);
const KNOWN_LEDGER_CODES = new Set([
  'NONE','ARCHIVE_COMPLETED','WRITE_COMPLETED','READ_COMPLETED','UPLOAD_COMPLETED',
  'PUBLISH_COMPLETED','NO_NEW_OBSERVATION','NO_CHANGE','NO_DATA',
  'UNCHANGED_SOURCE_OBSERVATION','BELOW_APPROVED_15M_CADENCE',
  'LEDGER_NOT_FOUND','INVALID_LEDGER','STATE_UNKNOWN','EXECUTION_TIMEOUT',
  'SOURCE_UNAVAILABLE','READ_FAILED','WRITE_FAILED','UPLOAD_FAILED','PUBLISH_FAILED',
]);
const safeLedgerStatus = value => typeof value==='string' && KNOWN_LEDGER_STATUSES.has(value) ? value : null;
const safeLedgerCode = value => typeof value==='string' && KNOWN_LEDGER_CODES.has(value) ? value : null;
const safeStoredAt = value => Number.isSafeInteger(value)&&value>0 ? value : null;

// Stage/error hints expose categories only. The sidecar ledger is untrusted, so
// its original messages, arbitrary codes and field names must never be returned.
const FAILURE_HINT_FIELDS = ['stage','step','code','lastPass','firstFail','reason','error','errorCode','message','blockedBy'];
const FAILURE_CATEGORIES = [
  ['LOCK_OR_LEASE', ['LOCK','LOCKED','LEASE','BUSY','CONCURRENT','CONFLICT']],
  ['SOURCE_OR_APPROVAL', ['SOURCE','APPROVAL','APPROVED','SHA','DRIFT','VERSION']],
  ['DATABASE', ['SQLITE','DATABASE','DB']],
  ['FILE_OR_PATH', ['ENOENT','FILE','PATH','DIRECTORY','MISSING']],
  ['PUBLICATION', ['PUBLISH','PUBLICATION','UPLOAD','REMOTE','D1','READBACK','WRANGLER']],
  ['AUTHENTICATION', ['AUTH','AUTHENTICATION','CREDENTIAL','TOKEN','PERMISSION','FORBIDDEN']],
  ['TIMEOUT', ['TIMEOUT','DEADLINE']],
  ['OBSERVATION_OR_CADENCE', ['OBSERVATION','OBSERVED','CURRENT','CHECK','CHECKS','CADENCE','UNCHANGED']],
  ['PROCESS', ['PROCESS','SPAWN','EXIT','COMMAND','TASK']],
];
// These are unverified labels inferred from the sidecar ledger, not operating
// system errors or proof that an approved source SHA was actually executed.
const REPORTED_BLOCK_SUBTYPES = [
  ['SOURCE_SHA_MISMATCH', ['SOURCE_SHA_MISMATCH','SOURCE_SHA_DRIFT','SOURCE_REVISION_MISMATCH','EXECUTED_SOURCE_SHA_MISMATCH']],
  ['APPROVAL_MISSING', ['APPROVAL_MISSING','MISSING_APPROVAL','SOURCE_NOT_APPROVED','UNAPPROVED_SOURCE']],
  ['APPROVAL_MISMATCH', ['APPROVAL_MISMATCH','APPROVAL_SHA_MISMATCH','APPROVED_SOURCE_SHA_MISMATCH']],
  ['SOURCE_UNAVAILABLE', ['SOURCE_UNAVAILABLE','SOURCE_NOT_FOUND','SOURCE_CHECKOUT_MISSING']],
];
const safeSha40 = value => typeof value==='string' && /^[0-9a-f]{40}$/i.test(value) ? value.toLowerCase() : null;
function reportedShaRelation(fields) {
  const select = keys => {
    const values=[...new Set(fields.flatMap(o=>keys.map(k=>safeSha40(o[k]))).filter(Boolean))];
    return {present:values.length>0, sha:values.length===1?values[0]:null, conflict:values.length>1};
  };
  const actual=select(['actualSourceSha','executedSourceSha']);
  const approved=select(['approvedSourceSha','expectedSourceSha']);
  return {evidence:'UNATTESTED_LEDGER_FIELDS',actualPresent:actual.present,approvedPresent:approved.present,
    relation:actual.conflict||approved.conflict?'CONFLICTING_FIELDS':!actual.sha||!approved.sha?'UNKNOWN':actual.sha===approved.sha?'MATCH':'MISMATCH'};
}

function failureHints(fields) {
  const getValue = key => fields.map(o=>o[key]).find(v=>v!==undefined&&v!==null);
  const classify = value => {
    if (value && typeof value==='object' && !Array.isArray(value)) value=value.code??value.message;
    if (typeof value!=='string' || value.length>4096) return null;
    // Whole tokens only: `BLOCKED` must never match the `LOCK` hint.
    const tokens=new Set(value.toUpperCase().split(/[^A-Z0-9]+/));
    return FAILURE_CATEGORIES.find(([,words])=>words.some(word=>tokens.has(word)))?.[0]??'UNCLASSIFIED';
  };
  const present=FAILURE_HINT_FIELDS.filter(key=>getValue(key)!==undefined);
  const classifications=[...new Set(present.map(key=>classify(getValue(key))).filter(Boolean))];
  const specific=[...new Set(present.flatMap(key=>{
    let value=getValue(key);
    if (value && typeof value==='object' && !Array.isArray(value)) value=value.code??value.message;
    if (typeof value!=='string' || value.length>4096) return [];
    const normalized=value.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean).join('_');
    return REPORTED_BLOCK_SUBTYPES.filter(([,phrases])=>phrases.some(phrase=>
      normalized===phrase||normalized.startsWith(phrase+'_')||normalized.endsWith('_'+phrase)||normalized.includes('_'+phrase+'_'))).map(([label])=>label);
  }))];
  return {evidence:'UNATTESTED_CATEGORICAL_HINTS',hasStage:present.includes('stage')||present.includes('step'),
    hasError:present.some(key=>['error','errorCode','message'].includes(key)),
    hasReason:present.includes('reason')||present.includes('blockedBy'),
    categories:classifications.slice(0,5),reportedBlockSubtype:specific.length===1?specific[0]:'UNKNOWN'};
}

function isInsideRealRoot(root, candidate) {
  try {
    const base=fs.realpathSync.native(root);
    const resolved=fs.realpathSync.native(candidate);
    const relative=path.relative(base,resolved);
    return relative!=='' && relative!=='..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  } catch { return false; }
}

function publicationLedgerTrace(dataRoot) {
  // Existing global writer evidence; not proof of a specific archive publish.
  const file=path.join(dataRoot,'pc-writer','local-publication-ledger.json');
  let stat;
  try { stat=fs.lstatSync(file); }
  catch(error) { return {evidence:error?.code==='ENOENT'?'NOT_FOUND':'UNKNOWN'}; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size<2 || stat.size>MAX_LEDGER_BYTES)
    return {evidence:'UNKNOWN',reason:'INVALID_FILE_TYPE_OR_SIZE'};
  if (!isInsideRealRoot(dataRoot,file)) return {evidence:'UNKNOWN',reason:'UNSAFE_REAL_PATH'};
  try {
    const bytes=fs.readFileSync(file);
    if (bytes.length>MAX_LEDGER_BYTES) return {evidence:'UNKNOWN',reason:'TOO_LARGE'};
    const data=JSON.parse(bytes.toString('utf8'));
    if (!data || typeof data!=='object' || Array.isArray(data)) throw Error('INVALID');
    return {evidence:'UNATTESTED_LEDGER',reportedStatus:safeLedgerStatus(data.status),
      at:Number.isSafeInteger(data.at)&&data.at>0?new Date(data.at).toISOString():null,
      modifiedAt:stat.mtime.toISOString(),sha256:hash(bytes),scope:'GLOBAL_PUBLICATION_ONLY'};
  } catch { return {evidence:'UNKNOWN',reason:'INVALID_LEDGER'}; }
}

// A bounded, read-only look at dedicated sidecar evidence. A file's existence
// or a reported PASS is never proof that a process executed independently.
function sidecarTrace(dataRoot) {
  const directory = path.join(dataRoot, 'pc-writer', 'archive-sidecar-r7');
  let info;
  try { info = fs.lstatSync(directory); }
  catch(error) { return {evidence:error?.code==='ENOENT'?'NOT_FOUND':'UNKNOWN',reason:error?.code==='ENOENT'?'SIDECAR_DIRECTORY_MISSING':'DIRECTORY_NOT_READABLE'}; }
  if (info.isSymbolicLink() || !info.isDirectory()) return {evidence:'UNKNOWN',reason:'UNSAFE_SIDECAR_DIRECTORY'};
  if (!isInsideRealRoot(dataRoot,directory)) return {evidence:'UNKNOWN',reason:'UNSAFE_REAL_PATH'};
  let entries;
  try { entries=fs.readdirSync(directory, {withFileTypes:true}); }
  catch { return {evidence:'UNKNOWN',reason:'DIRECTORY_NOT_READABLE'}; }
  if (entries.length>MAX_SIDECAR_FILES) return {evidence:'UNKNOWN',reason:'DIRECTORY_ENTRY_LIMIT'};
  const names=entries.filter(entry=>LEDGER_NAME.test(entry.name)).map(entry=>entry.name).sort();
  if (!names.length) return {evidence:'NOT_FOUND',reason:'LEDGER_NOT_FOUND'};
  if (names.length>MAX_LEDGER_FILES) return {evidence:'UNKNOWN',reason:'LEDGER_FILE_LIMIT'};
  const candidates=[];
  for (const name of names) {
    const file=path.join(directory,name);
    let stat;
    try { stat=fs.lstatSync(file); }
    catch { candidates.push({name,evidence:'NOT_READABLE'});continue; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size>MAX_LEDGER_BYTES || stat.size<2) {
      candidates.push({name,evidence:'INVALID_FILE_TYPE_OR_SIZE'});continue;
    }
    if (!isInsideRealRoot(directory,file)) { candidates.push({name,evidence:'UNSAFE_REAL_PATH'});continue; }
    try {
      const bytes=fs.readFileSync(file);
      if (bytes.length>MAX_LEDGER_BYTES) { candidates.push({name,evidence:'TOO_LARGE'});continue; }
      const data=JSON.parse(bytes.toString('utf8'));
      if (!data || typeof data!=='object' || Array.isArray(data)) throw Error('INVALID_LEDGER');
      const fields=[data,data.result,data.archive,data.lastRun].filter(v=>v && typeof v==='object' && !Array.isArray(v));
      const firstValid=(key,validator)=>fields.map(o=>validator(o[key])).find(v=>v!==null)??null;
      const reportedStatus=firstValid('status',safeLedgerStatus);
      const code=firstValid('code',safeLedgerCode);
      const firstFail=firstValid('firstFail',safeLedgerCode);
      const lastPass=firstValid('lastPass',safeLedgerCode);
      const reason=firstValid('reason',safeLedgerCode);
      const at=['finishedAt','startedAt','checkedAt','at','timestamp'].map(key=>firstValid(key,safeIso)).find(v=>v!==null)??null;
      candidates.push({name,evidence:'UNATTESTED_LEDGER',sha256:hash(bytes),modifiedAt:stat.mtime.toISOString(),
        reportedStatus,code,lastPass,firstFail,reason,at,failureHints:failureHints(fields),
        reportedShaRelation:reportedShaRelation(fields)});
    } catch { candidates.push({name,evidence:'INVALID_LEDGER'}); }
  }
  return {evidence:'OBSERVED_UNATTESTED',candidates};
}

// The installed Sidecar is PC-only; do not publish its source or failure text.
// Inspect two previously hashed fixed scripts and one bounded ledger in memory.
// Explicit error-raising statements are static clues, never proof of execution.
export function inspectSidecarSourceGate(dataRoot, {
  expectedHashes = SIDECAR_SOURCE_EXPECTED, priorSidecar = null,
} = {}) {
  const output={evidence:'UNATTESTED_STATIC_SOURCE_AND_LEDGER',
    scriptStatus:[],ledgerStatus:'UNKNOWN',sameLedgerSnapshot:null,
    reasonShape:'NOT_CHECKED',reasonConcepts:[],
    matchingErrorSite:'NOT_CHECKED',matchedScript:null,siteLine:null,
    gatePatternCategories:[],matchedGateCategories:[],operationalWrites:0,providerCalls:0,d1Writes:0};
  const directory=path.join(dataRoot,'pc-writer','archive-sidecar-r7');
  let stat;
  try{stat=fs.lstatSync(directory);}catch(error){return {...output,ledgerStatus:error?.code==='ENOENT'?'DIRECTORY_MISSING':'DIRECTORY_NOT_READABLE'};}
  if(!stat.isDirectory()||stat.isSymbolicLink()||!isInsideRealRoot(dataRoot,directory))
    return {...output,ledgerStatus:'UNSAFE_DIRECTORY'};
  const readBounded=(name,maximum)=>{
    const file=path.join(directory,name);
    let info;
    try{info=fs.lstatSync(file);}catch(error){return {status:error?.code==='ENOENT'?'MISSING':'NOT_READABLE'};}
    if(!info.isFile()||info.isSymbolicLink()||!isInsideRealRoot(directory,file))
      return {status:'UNSAFE'};
    if(info.size<2||info.size>maximum)return {status:'INVALID_SIZE'};
    try{
      const bytes=fs.readFileSync(file);
      if(bytes.length<2||bytes.length>maximum)return {status:'INVALID_SIZE'};
      return {status:'READ',bytes,modifiedMs:info.mtimeMs};
    }catch{return {status:'NOT_READABLE'};}
  };
  const ledger=readBounded('last-run.json',MAX_LEDGER_BYTES);
  output.ledgerStatus=ledger.status;
  if(ledger.status!=='READ')return output;
  const old=priorSidecar?.candidates?.find(x=>x.name==='last-run.json');
  output.sameLedgerSnapshot=old?.sha256?hash(ledger.bytes)===old.sha256:null;
  if(output.sameLedgerSnapshot===false){
    output.ledgerStatus='CHANGED_DURING_DIAGNOSIS';return output;
  }
  let data;
  try{
    data=JSON.parse(ledger.bytes.toString('utf8'));
    if(!data||typeof data!=='object'||Array.isArray(data))throw Error('INVALID');
  }catch{output.ledgerStatus='INVALID_JSON';return output;}
  output.ledgerStatus='READ';
  const fields=[data,data.result,data.archive,data.lastRun].filter(v=>v&&typeof v==='object'&&!Array.isArray(v));
  const raw=fields.flatMap(o=>[o.reason,o.blockedBy]).find(v=>v!==undefined&&v!==null);
  let reason=null;
  if(typeof raw==='string'){output.reasonShape='STRING';reason=raw;}
  else if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    output.reasonShape='OBJECT';reason=typeof raw.code==='string'?raw.code:raw.message;
  }else output.reasonShape='MISSING';
  if(typeof reason==='string'&&reason.length>4096){output.reasonShape='OVERSIZE';reason=null;}
  if(typeof reason==='string'){
    const tokens=new Set(reason.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
    const concepts=['SOURCE','APPROVAL','APPROVED','CONFIG','GIT','HEAD','SHA','DIRTY',
      'BRANCH','MISMATCH','MISSING','UNAVAILABLE','DRIFT','REPO','PATH',
      'CHECKOUT','WORKTREE','ARCHIVE','LOCK','PERMISSION','CLEAN'];
    output.reasonConcepts=concepts.filter(word=>tokens.has(word)).slice(0,12);
  }
  const sites=[],gates=new Set();
  for(const name of Object.keys(SIDECAR_SOURCE_EXPECTED)){
    const file=readBounded(name,MAX_SIDECAR_SOURCE_BYTES);
    const item={file:name,status:file.status};
    if(file.status!=='READ'){output.scriptStatus.push(item);continue;}
    item.status=pinnedSidecarSourceMatch(hash(file.bytes),expectedHashes[name])?'MATCH':'CHANGED';
    item.modifiedAfterLedger=file.modifiedMs>ledger.modifiedMs;
    output.scriptStatus.push(item);
    if(item.status!=='MATCH'||item.modifiedAfterLedger)continue;
    // Windows Script Host source may be UTF-16; decoding is in-memory only.
    const source=xmlString(file.bytes);
    if(source.includes('\uFFFD'))continue;
    if(/(?:config\.source|approvedSourceSha|sourceSha)/i.test(source))gates.add('SOURCE_APPROVAL_REFERENCE');
    if(/(?:rev-parse|git\.exe|execFileSync\(['"]git)/i.test(source))gates.add('GIT_REFERENCE');
    if(/(?:diff\s+--quiet|status\s+--porcelain|dirty)/i.test(source))gates.add('CLEAN_TREE_REFERENCE');
    if(/(?:archive-core\.mjs|archive-run\.mjs)/i.test(source))gates.add('ARCHIVE_LAUNCH_REFERENCE');
    if(typeof reason!=='string'||!reason.length)continue;
    // Only explicit JS throw Error / VBS Err.Raise statements count. Comments,
    // logs, constants and other quoted literals cannot establish error sites.
    const lines=source.split(/\r?\n/);
    for(let index=0;index<lines.length;index++){
      const line=lines[index];
      let matched=false;
      if(name.endsWith('.mjs')){
        const thrown=line.match(/^\s*throw\s+(?:new\s+)?Error\s*\(\s*(['"])([^'"\r\n]{2,160})\1\s*\)/);
        matched=thrown?.[2]===reason;
      }else if(name.endsWith('.vbs')){
        // Err.Raise(number, source, description): only the third argument is
        // the failure description; a matching source label is insufficient.
        const raised=line.match(/^\s*(?:Call\s+)?Err\.Raise\s+[^,\r\n]{1,64},\s*[^,\r\n]{0,160},\s*(['"])([^'"\r\n]{2,160})\1(?:\s*,|\s*$)/i);
        matched=raised?.[2]===reason;
      }
      if(!matched)continue;
      const nearby=lines.slice(Math.max(0,index-3),Math.min(lines.length,index+4)).join('\n');
      const categories=[];
      if(/(?:config\.source|approvedSourceSha|sourceSha)/i.test(nearby))categories.push('SOURCE_APPROVAL_REFERENCE');
      if(/(?:rev-parse|git\.exe|execFileSync\(['"]git)/i.test(nearby))categories.push('GIT_REFERENCE');
      if(/(?:diff\s+--quiet|status\s+--porcelain|dirty)/i.test(nearby))categories.push('CLEAN_TREE_REFERENCE');
      sites.push({name,line:index+1,categories});
      if(sites.length>32)break;
    }
  }
  if(output.scriptStatus.some(x=>x.status!=='MATCH'||x.modifiedAfterLedger)){
    output.matchingErrorSite='NOT_CHECKED';return output;
  }
  output.gatePatternCategories=[...gates].sort();
  output.matchingErrorSite=sites.length===1?'UNIQUE':sites.length>1?'MULTIPLE':'NONE';
  if(sites.length===1){output.matchedScript=sites[0].name;output.siteLine=sites[0].line;
    output.matchedGateCategories=sites[0].categories;}
  return output;
}

function archiveAlignment(local) {
  if (local?.status!=='READ') return {status:'UNKNOWN'};
  const current=local.currentPublic;
  const originalAt=local.original?.latest?.lastAt;
  const checkAt=local.checks?.latest?.lastAt;
  const currentAt=current?.observedAt, storedAt=current?.storedAt;
  const currentObservedMs=currentAt?Date.parse(currentAt):NaN;
  const originalMs=originalAt?Date.parse(originalAt):NaN;
  const checkMs=checkAt?Date.parse(checkAt):NaN;
  const gaps={currentObservedNewerThanOriginal:Number.isFinite(currentObservedMs)&&Number.isFinite(originalMs)?currentObservedMs>originalMs:null,
    currentStoredNewerThanCheck:Number.isFinite(storedAt)&&Number.isFinite(checkMs)?storedAt>checkMs:null};
  return {status:Object.values(gaps).some(v=>v===true)?'HISTORY_DIVERGENCE':Object.values(gaps).some(v=>v===null)?'UNKNOWN':'NO_NEWER_CURRENT_IN_LATEST_SNAPSHOTS',...gaps,
    cause:'UNKNOWN'};
}

function xmlString(value) {
  if (!Buffer.isBuffer(value)) return String(value ?? '');
  if (value[0] === 0xff && value[1] === 0xfe) return value.subarray(2).toString('utf16le');
  if (value[0] === 0xfe && value[1] === 0xff) return value.subarray(2).swap16().toString('utf16le');
  return value.subarray(0, 128).includes(0) ? value.toString('utf16le') : value.toString('utf8');
}

function decodeXml(value) {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_, key) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[key]);
}

function extractTag(xml, name) {
  return decodeXml(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i').exec(xml)?.[1] ?? '');
}

function extractApprovedScripts(value) {
  const matches = value.match(/[a-z]:\\[^"\r\n<>]*?\.(?:vbs|cmd|mjs)/gi) ?? [];
  return [...new Set(matches.map(p => path.win32.normalize(p)))].filter(p =>
    ALLOWED_ROOTS.some(root => p.toLowerCase().startsWith(root)));
}

function inspectLaunchers(xml, readFile = fs.readFileSync, stat = fs.statSync) {
  const action = /<Exec>([\s\S]*?)<\/Exec>/i.exec(xml)?.[1] ?? '';
  const command = extractTag(action, 'Command');
  const argumentsText = extractTag(action, 'Arguments');
  const commandBase = command ? path.win32.basename(command).toLowerCase() : null;
  const result = {
    hasExecAction: !!action,
    commandBase: commandBase && /^[a-z0-9_.-]{1,80}$/.test(commandBase) ? commandBase : null,
    actionSha256: hash(action),
    referencedScripts: [],
  };
  const pending = extractApprovedScripts(command + ' ' + argumentsText);
  const seen = new Set();
  while (pending.length && seen.size < 6) {
    const candidate = pending.shift();
    if (seen.has(candidate.toLowerCase())) continue;
    seen.add(candidate.toLowerCase());
    const entry = { relativePath: candidate.slice(3).replaceAll('\\', '/'), exists: false };
    result.referencedScripts.push(entry);
    try {
      const info = stat(candidate);
      if (!info.isFile() || info.size > MAX_LAUNCHER_BYTES) { entry.reason = 'NOT_BOUNDED_TEXT_FILE'; continue; }
      // Inspect text and hashes only. No script is executed, and contents are not returned.
      const content = readFile(candidate);
      const body = content.toString('utf8');
      entry.exists = true;
      entry.sha256 = hash(content);
      entry.references = {
        archiveRun: /archive-run\.mjs/i.test(body),
        archiveCore: /archive-core\.mjs/i.test(body),
        verifiedChecksR9: /verified-checks-r9/i.test(body),
        quotaRunner: /quota-runner\.mjs/i.test(body),
        localCycle: /local-cycle\.mjs/i.test(body),
      };
      if (seen.size < 5) pending.push(...extractApprovedScripts(body));
    } catch { entry.reason = 'FILE_NOT_READABLE'; }
  }
  return result;
}

function summary(rows, countField, timeField) {
  let total = 0;
  const dates = [];
  for (const row of rows) {
    let payload;
    try { payload = JSON.parse(row.body); } catch { return { status:'INVALID_JSON', snapshotKey:row.snapshot_key }; }
    const points = payload?.[countField];
    if (!Array.isArray(points)) return { status:'INVALID_SHAPE', snapshotKey:row.snapshot_key };
    total += points.length;
    dates.push({date:/^\d{4}-\d\d-\d\d$/.test(row.snapshot_key)?row.snapshot_key:null, count:points.length,
      lastAt:safeIso(points.at(-1)?.[timeField]),
      storedAt:safeStoredAt(row.stored_at)});
  }
  return {status:'READ',days:rows.length,pointCount:total,latest:dates[0]??null,
    recentDates:dates.slice(0,7)};
}

function feedRows(db, key) {
  return db.prepare("SELECT snapshot_key,stored_at,body FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? AND snapshot_key GLOB '????-??-??' ORDER BY snapshot_key DESC LIMIT 90").all(key);
}

// Project only fixed, non-sensitive composite stage metadata from the existing
// Writer checkpoint. This is NOT direct D1 verification or proof of new input.
const COMPOSITE_STAGE_STATUSES=new Set([
 'LOCAL_STORED','UNCHANGED','VERIFIED','BACKLOG','PENDING',
 'PENDING_VERIFIED_MARKET','PREVIOUS_RELEASE_PRESERVED',
 'REMOTE_NEWER_PRESERVED','FAILED','UNAVAILABLE','PARTIAL',
]);
const COMPOSITE_FAILURE_IDS=new Set([
 'market','composite-archive-local','market-publication',
 'composite-observed-publication',
]);
const safeCompositeStage=value=>typeof value==='string'&&
 COMPOSITE_STAGE_STATUSES.has(value)?value:null;
const safeTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)?
 new Date(value).toISOString():null;

export function inspectCompositeWriterCheckpoint(dataRoot){
 const file=path.join(dataRoot,'pc-writer','local-writer-last-run.json');
 let root;try{root=fs.realpathSync.native(dataRoot)}catch{return {state:'ROOT_UNAVAILABLE'}}
 const r=readFixedReadonlyBytes(file,{verifiedRoot:root,minBytes:2,maxBytes:131072});
 if(!r.ok)return {state:r.reason};
 let w;try{w=JSON.parse(r.bytes.toString('utf8'));}catch{return {state:'INVALID_JSON'}}
 if(!w||typeof w!=='object'||Array.isArray(w))return {state:'INVALID_SHAPE'};
 const stage=v=>v&&typeof v==='object'&&!Array.isArray(v)?
  {status:safeCompositeStage(v.status),storedDays:Number.isSafeInteger(v.storedDays)&&v.storedDays>=0?v.storedDays:null,
   publishedDays:Number.isSafeInteger(v.publishedDays)&&v.publishedDays>=0?v.publishedDays:null,
   deferredDays:Number.isSafeInteger(v.deferredDays)&&v.deferredDays>=0?v.deferredDays:null,
   points:Number.isSafeInteger(v.points)&&v.points>=0?v.points:null}:null;
 const failures=Array.isArray(w.failures)?w.failures.slice(0,80)
  .filter(x=>x&&COMPOSITE_FAILURE_IDS.has(x.id)).map(x=>x.id):[];
 return {state:'READ',evidence:'LOCAL_WRITER_LEDGER_ONLY_NOT_INDEPENDENT_EXECUTION',
  checkpointSha256:hash(r.bytes),at:safeTime(w.at),
  mode:w.mode==='PUBLISH'?'PUBLISH':w.mode==='DRY_RUN'?'DRY_RUN':null,
  writerStatus:safeLedgerStatus(w.status),
  market:stage(w.market),compositeArchiveLocal:stage(w.compositeObserved),
  compositePublication:stage(w.compositeObservedPublication),
  failedStages:[...new Set(failures)],d1PerKeyReadback:'NOT_VERIFIED'};
}

function readDb(dataRoot) {
  const dbFile=path.join(dataRoot,'pc-writer','storage','core.sqlite');
  if (!fs.existsSync(dbFile)) return {sqliteOpened:false,status:'DB_NOT_FOUND'};
  let db;
  try {
    db = new DatabaseSync(dbFile, {readOnly:true,timeout:1000});
    db.exec('PRAGMA query_only=ON');
    const current = db.prepare("SELECT stored_at,body FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key='fear-greed' AND snapshot_key='current'").get();
    let currentPublic = null;
    if (current) {
      const body = JSON.parse(current.body);
      currentPublic = {status:safeStatus(body?.status), score:Number.isFinite(body?.score)&&body.score>=0&&body.score<=100?body.score:null,
        observedAt:safeIso(body?.observedAt), storedAt:safeStoredAt(current.stored_at)};
    }
    const original = summary(feedRows(db,'fear-greed-observed'),'observations','observedAt');
    const checks = summary(feedRows(db,'fear-greed-verified-checks'),'checks','checkedAt');
    const composite = summary(db.prepare("SELECT snapshot_key,stored_at,body FROM market_public_snapshots_v1 WHERE snapshot_key LIKE 'composite-observed:%' ORDER BY snapshot_key DESC LIMIT 90").all().map(r=>({...r,snapshot_key:r.snapshot_key.replace('composite-observed:','')})),'points','calculatedAt');
    // Use the same native read-only SQLite connection; hash exact stored UTF-8
    // bodies, never return raw current/observation payload or credentials.
    const currentComposite=db.prepare("SELECT body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key='current'").get();
    const lastComposite=db.prepare("SELECT snapshot_key,body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key LIKE 'composite-observed:%' ORDER BY snapshot_key DESC LIMIT 1").get();
    const project=row=>row&&typeof row.body==='string'&&Buffer.byteLength(row.body,'utf8')<=2_000_000?
      {storedAt:safeStoredAt(row.stored_at),bodySha256:hash(Buffer.from(row.body,'utf8'))}:null;
    const localCompositeKeys={current:project(currentComposite),
      latestArchiveKey:lastComposite&&/^composite-observed:\d{4}-\d\d-\d\d$/.test(lastComposite.snapshot_key)?lastComposite.snapshot_key:null,
      latestArchive:project(lastComposite)};
    return {sqliteOpened:true,status:'READ',currentPublic,original,checks,composite,localCompositeKeys};
  } catch(error) {
    return {sqliteOpened:!!db,status:'READ_FAILED',errorCode: typeof error?.code==='string'&&/^ERR_[A-Z_]+$|^SQLITE_[A-Z_]+$/.test(error.code)?error.code:'SQLITE_READ_ERROR'};
  } finally {try{db?.close()}catch{}}
}

export function inspectFearGreedArchive(dataRoot,{queryTask}={}) {
  let task;
  try { task = inspectLaunchers(xmlString(queryTask(CORE_TASK))); }
  catch { task = {status:'TASK_READ_FAILED'}; }
  const local=readDb(dataRoot);
  const complete=local.status==='READ';
  const sidecar=sidecarTrace(dataRoot);
  return {status:complete?'PASS':'BLOCKED',code:complete?'FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS':`FEAR_GREED_${local.status}`,
    task,local,writerComposite:inspectCompositeWriterCheckpoint(dataRoot),archiveTrace:{alignment:archiveAlignment(local),sidecar,
      sidecarSourceGate:inspectSidecarSourceGate(dataRoot,{priorSidecar:sidecar}),
      publicationLedger:publicationLedgerTrace(dataRoot)},
    sqliteOpened:local.sqliteOpened,operationalWrites:0,providerCalls:0,d1Writes:0,
    scope:'READ_ONLY_NO_PROVIDER_NO_PUBLICATION'};
}
