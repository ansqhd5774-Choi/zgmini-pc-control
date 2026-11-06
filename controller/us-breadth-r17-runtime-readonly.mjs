/** Narrow, read-only evidence for the R17 IEX provisional PC lane.
 * A/light operation: no SQLite, provider, D1, process, or scheduler access.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const FILE_LIMIT = 8 * 1024 * 1024;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS = /^[A-Z][A-Z0-9_]{1,100}$/;
const COUNT = n => Number.isSafeInteger(n) && n >= 0;
const SHA256 = bytes => createHash('sha256').update(bytes).digest('hex');

function readSmallObject(file) {
  let stat;
  try { stat = fs.lstatSync(file); }
  catch (error) { return {state: error?.code === 'ENOENT' ? 'MISSING' : 'UNREADABLE'}; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > FILE_LIMIT)
    return {state:'UNSAFE_OR_OVERSIZE'};
  try {
    const bytes = fs.readFileSync(file);
    if (bytes.length !== stat.size) return {state:'CHANGED_DURING_READ'};
    const value = JSON.parse(bytes.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {state:'INVALID_JSON'};
    return {state:'READ', value, sha256:SHA256(bytes), modifiedAt:stat.mtime.toISOString()};
  } catch { return {state:'INVALID_JSON'}; }
}

function cleanUsProvisionalCode(value) {
  return typeof value === 'string' && /^US_PROVISIONAL_[A-Z0-9_]{1,80}$/.test(value) ? value : null;
}
function cleanStatus(value) { return typeof value === 'string' && STATUS.test(value) ? value : null; }
function cleanIso(value) { return typeof value === 'string' && ISO.test(value) && Number.isFinite(Date.parse(value)) ? value : null; }
function cleanDate(value) {
  return typeof value === 'string' && DATE.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value ? value : null;
}
function cleanCount(value) { return COUNT(value) ? value : null; }

function beforeFirstSlot(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone:'America/New_York', weekday:'short', hour:'2-digit', minute:'2-digit',
    hour12:false, hourCycle:'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(p => [p.type,p.value]));
  const weekday = values.weekday;
  const hour = Number(values.hour), minute = Number(values.minute);
  // No holiday/calendar prediction: the marker only means the first slot
  // cannot yet be completed, not that a session is guaranteed today.
  return weekday !== 'Sat' && weekday !== 'Sun' &&
    (hour < 9 || (hour === 9 && minute < 46));
}

function validOutput(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return false;
  const {expectedCount,observedCount,missingCount,counts,
    sessionPriceObservedCount,referenceObservedCount,freshWithin30m,coverage} = output;
  return output.version === 1 && output.phase === 'PROVISIONAL' &&
    output.status === 'PROVISIONAL' && output.market === 'usa' &&
    output.universe === 'SP500' &&
    output.source === 'ALPACA_IEX_15MIN_SPLIT' &&
    output.referenceSource === 'ALPACA_IEX_1DAY_SPLIT' &&
    output.methodologyVersion === 'OBSERVED_ISSUE_DIRECTION_COUNTS_R1' &&
    cleanDate(output.observationDate) !== null && cleanDate(output.priorDate) !== null &&
    cleanIso(output.slotEndUtc) !== null && cleanIso(output.collectedAt) !== null &&
    Date.parse(output.slotEndUtc) <= Date.parse(output.collectedAt) &&
    COUNT(expectedCount) && expectedCount >= 490 && expectedCount <= 520 &&
    COUNT(observedCount) && COUNT(missingCount) &&
    observedCount + missingCount === expectedCount &&
    COUNT(sessionPriceObservedCount) && sessionPriceObservedCount <= expectedCount &&
    COUNT(referenceObservedCount) && referenceObservedCount <= expectedCount &&
    observedCount <= sessionPriceObservedCount && observedCount <= referenceObservedCount &&
    COUNT(freshWithin30m) && freshWithin30m <= observedCount &&
    typeof coverage === 'number' && Number.isFinite(coverage) &&
    Math.abs(coverage - observedCount / expectedCount) <= 1e-9 &&
    counts && typeof counts === 'object' && !Array.isArray(counts) &&
    Object.keys(counts).sort().join(',') === 'falling,rising,unchanged' &&
    COUNT(counts.rising) && COUNT(counts.falling) && COUNT(counts.unchanged) &&
    counts.rising + counts.falling + counts.unchanged === observedCount &&
    ['COMPLETE','INCOMPLETE_PAGINATION'].includes(output.collectionStatus);
}

function storedFreshness(output,now) {
  if (!validOutput(output) || !Number.isFinite(now?.getTime?.()))
    return {state:'UNKNOWN',ageMinutes:null};
  const ageMinutes = (now.getTime() - Date.parse(output.slotEndUtc)) / 60000;
  // Recency alone cannot establish a current NYSE session or expected slot.
  return {state:ageMinutes < 0 ? 'FUTURE_SLOT' : ageMinutes <= 30 ?
    'RECENT_30M_SESSION_UNVERIFIED' : 'STALE_OVER_30M',
  ageMinutes:Math.round(ageMinutes * 100) / 100};
}

/** The caller supplies the configured PC data root, never an Issue path. */
export function inspectUsBreadthR17Runtime(dataRoot,{now=new Date()}={}) {
  const writerRoot = path.join(dataRoot,'pc-writer');
  let rootStat;
  try { rootStat = fs.lstatSync(writerRoot); } catch { rootStat = null; }
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink())
    return {status:'BLOCKED',code:'R17_RUNTIME_WRITER_ROOT_UNAVAILABLE',providerCalls:0,d1Writes:0,sqliteOpened:false};

  const cycle = readSmallObject(path.join(writerRoot,'local-cycle-last-run.json'));
  const sidecar = readSmallObject(path.join(writerRoot,'local-us-breadth-iex-provisional.json'));
  const early = readSmallObject(path.join(writerRoot,'local-us-breadth-provisional-early-last-run.json'));
  const cycleInfo = cycle.state === 'READ' ? {
    modifiedAt:cycle.modifiedAt,sha256:cycle.sha256,
    status:cleanStatus(cycle.value.status),lane:cycle.value.lane === 'core' ? 'core' : null,
    usProvisional:cleanStatus(cycle.value.usProvisional?.status),
    usProvisionalCode:cleanUsProvisionalCode(cycle.value.usProvisional?.code),
    usProvisionalEarlyPublication:cleanStatus(cycle.value.usProvisionalEarlyPublication?.status),
    usProvisionalSlotEndUtc:cleanIso(cycle.value.usProvisional?.slotEndUtc),
  } : null;
  const earlyInfo = early.state === 'READ' ? {
    modifiedAt:early.modifiedAt,sha256:early.sha256,
    status:cleanStatus(early.value.status),
    inputStatus:cleanStatus(early.value.inputStatus),
    publicationStatus:cleanStatus(early.value.publication?.status),
    slotEndUtc:cleanIso(early.value.slotEndUtc),
  } : null;
  const stored = sidecar.state === 'READ' ? sidecar.value : null;
  const output = stored?.output;
  const outputValid = validOutput(output);
  const attemptedStatus = cleanStatus(stored?.attemptStatus);
  const provenance = sidecar.state === 'READ' ? {sha256:sidecar.sha256,modifiedAt:sidecar.modifiedAt} : null;
  const freshness = storedFreshness(output,now);
  const cycleSlotEnd = cleanIso(cycle.value?.usProvisional?.slotEndUtc);
  const outputSlotEnd = cleanIso(output?.slotEndUtc);
  const cycleSlotMatch = cycleSlotEnd && outputSlotEnd ?
    (cycleSlotEnd === outputSlotEnd ? 'MATCH' : 'MISMATCH') : 'UNAVAILABLE';
  const proof = sidecar.state !== 'READ' ?
    (sidecar.state === 'MISSING' && beforeFirstSlot(now) ? 'NOT_YET_ELIGIBLE' : `SIDECAR_${sidecar.state}`) :
    attemptedStatus === 'LOCAL_READY' && outputValid ? 'LOCAL_READY_STORED' :
    attemptedStatus === 'LOCAL_READY' ? 'INVALID_OUTPUT' :
    attemptedStatus === 'FAILED' || attemptedStatus === 'DEFERRED_QUOTA' ? 'LAST_ATTEMPT_UNVERIFIED' :
    'NOT_LOCAL_READY';
  return {
    status:'PASS',code:'R17_RUNTIME_READONLY_INSPECTED',
    evidenceStatus:proof,
    currentSlotVerified:false,cycleSlotMatch,storedFreshness:freshness.state,slotAgeMinutes:freshness.ageMinutes,
    cycle:{state:cycle.state,...cycleInfo},
    sidecar:{state:sidecar.state,...provenance,
      attemptStatus:attemptedStatus,
      lastAttemptSlot:typeof stored?.lastAttemptSlot === 'string' && stored.lastAttemptSlot.length <= 80 ? stored.lastAttemptSlot : null,
      attemptedAt:cleanIso(stored?.attemptedAt),
      outputValid,slotEndUtc:outputSlotEnd,
      observationDate:cleanDate(output?.observationDate),priorDate:cleanDate(output?.priorDate),
      collectedAt:cleanIso(output?.collectedAt),
      source:output?.source === 'ALPACA_IEX_15MIN_SPLIT' ? output.source : null,
      referenceSource:output?.referenceSource === 'ALPACA_IEX_1DAY_SPLIT' ? output.referenceSource : null,
      methodologyVersion:output?.methodologyVersion === 'OBSERVED_ISSUE_DIRECTION_COUNTS_R1' ? output.methodologyVersion : null,
      collectionStatus:cleanStatus(output?.collectionStatus),
      expectedCount:cleanCount(output?.expectedCount),
      observedCount:cleanCount(output?.observedCount),
      missingCount:cleanCount(output?.missingCount),
      sessionPriceObservedCount:cleanCount(output?.sessionPriceObservedCount),
      referenceObservedCount:cleanCount(output?.referenceObservedCount),
      freshWithin30m:cleanCount(output?.freshWithin30m),
      coverage:typeof output?.coverage === 'number' && Number.isFinite(output.coverage) ? output.coverage : null,
      risingCount:cleanCount(output?.counts?.rising),
      fallingCount:cleanCount(output?.counts?.falling),
      unchangedCount:cleanCount(output?.counts?.unchanged),
    },
    earlyPublication:{state:early.state,...earlyInfo},
    providerCalls:0,d1Writes:0,sqliteOpened:false,operationalWrites:0,
  };
}

