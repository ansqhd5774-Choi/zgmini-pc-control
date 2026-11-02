import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const CORE_TASK = 'ZGMINI-PC-Local-Core';
const MAX_LAUNCHER_BYTES = 131072;
const MAX_LEDGER_BYTES = 65536;
const MAX_SIDECAR_FILES = 64;
const MAX_LEDGER_FILES = 12;
const LEDGER_NAME = /^(?=[a-z0-9_.-]{1,100}\.json$)(?=.*(?:last-run|status|ledger|checkpoint|result|report))[a-z0-9_.-]+\.json$/i;
const ALLOWED_ROOTS = ['e:\\zgmini\\data\\pc-writer\\', 'e:\\zgmini\\projects\\'];
const safeIso = value => typeof value==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString()===value ? value : null;
const safeStatus = value => typeof value==='string' && /^[A-Z_a-z]{1,32}$/.test(value) ? value : null;
const safeCode = value => typeof value==='string' && /^[A-Z][A-Z0-9_:-]{0,79}$/.test(value) ? value : null;
const safeStoredAt = value => Number.isSafeInteger(value)&&value>0 ? value : null;

// A bounded, read-only look at dedicated sidecar evidence. A file's existence
// or a reported PASS is never proof that a process executed independently.
function sidecarTrace(dataRoot) {
  const directory = path.join(dataRoot, 'pc-writer', 'archive-sidecar-r7');
  let info;
  try { info = fs.lstatSync(directory); }
  catch(error) { return {evidence:'NOT_FOUND',reason:error?.code==='ENOENT'?'SIDECAR_DIRECTORY_MISSING':'DIRECTORY_NOT_READABLE'}; }
  if (info.isSymbolicLink() || !info.isDirectory()) return {evidence:'UNKNOWN',reason:'UNSAFE_SIDECAR_DIRECTORY'};
  let entries;
  try { entries=fs.readdirSync(directory, {withFileTypes:true}); }
  catch { return {evidence:'UNKNOWN',reason:'DIRECTORY_NOT_READABLE'}; }
  if (entries.length>MAX_SIDECAR_FILES) return {evidence:'UNKNOWN',reason:'DIRECTORY_ENTRY_LIMIT'};
  const names=entries.filter(entry=>entry.isFile() && !entry.isSymbolicLink() && LEDGER_NAME.test(entry.name)).map(entry=>entry.name).sort();
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
    try {
      const bytes=fs.readFileSync(file);
      if (bytes.length>MAX_LEDGER_BYTES) { candidates.push({name,evidence:'TOO_LARGE'});continue; }
      const data=JSON.parse(bytes.toString('utf8'));
      if (!data || typeof data!=='object' || Array.isArray(data)) throw Error('INVALID_LEDGER');
      const fields=[data,data.result,data.archive,data.lastRun].filter(v=>v && typeof v==='object' && !Array.isArray(v));
      const firstValid=(key,validator)=>fields.map(o=>validator(o[key])).find(v=>v!==null)??null;
      const reportedStatus=firstValid('status',safeCode);
      const code=firstValid('code',safeCode);
      const firstFail=firstValid('firstFail',safeCode);
      const lastPass=firstValid('lastPass',safeCode);
      const reason=firstValid('reason',safeCode);
      const at=['finishedAt','startedAt','checkedAt','at','timestamp'].map(key=>firstValid(key,safeIso)).find(v=>v!==null)??null;
      candidates.push({name,evidence:'UNATTESTED_LEDGER',sha256:hash(bytes),modifiedAt:stat.mtime.toISOString(),
        reportedStatus,code,lastPass,firstFail,reason,at});
    } catch { candidates.push({name,evidence:'INVALID_LEDGER'}); }
  }
  return {evidence:'OBSERVED_UNATTESTED',candidates};
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
  return {status:Object.values(gaps).some(v=>v===true)?'HISTORY_DIVERGENCE':Object.values(gaps).some(v=>v===null)?'UNKNOWN':'NO_DIVERGENCE_CONFIRMED',...gaps,
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
    return {sqliteOpened:true,status:'READ',currentPublic,original,checks,composite};
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
  return {status:complete?'PASS':'BLOCKED',code:complete?'FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS':`FEAR_GREED_${local.status}`,
    task,local,archiveTrace:{alignment:archiveAlignment(local),sidecar:sidecarTrace(dataRoot)},
    sqliteOpened:local.sqliteOpened,operationalWrites:0,providerCalls:0,d1Writes:0,
    scope:'READ_ONLY_NO_PROVIDER_NO_PUBLICATION'};
}
