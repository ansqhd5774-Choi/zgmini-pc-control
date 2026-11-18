// W05 C-grade BLS lineage receipt for an already installed A-grade source inventory.
// No network, publication, filesystem path input, stored raw rows or operational write.
// The caller owns the fixed SQLite path and opens it with PRAGMA query_only=ON.
import {createHash} from 'node:crypto';

const SERIES=Object.freeze(['WPSFD4','WPSFD41','PRS85006111']);
const CONTRACT='EARNINGS_COMPANION_R3C_BLS_DIRECT_V1';
const SCHEMA='earnings-companion-c-r4-v1';
const SHA=/^[a-f0-9]{64}$/;
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
const utc=x=>typeof x==='string'&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)&&
  Number.isFinite(Date.parse(x))&&new Date(Date.parse(x)).toISOString()===x;
const stop=()=>{throw Error('INVALID_BLS_LINEAGE');};
const none=code=>({status:'NOT_STORED',code,sourceVersion:null,
  sourceStoredAt:null,cohortRetrievedAt:null,newerIncomplete:null,
  snapshotsVerified:0,seriesVerified:0});

export function inspectEarningsCCheckpoint(db){
  const fallback={status:'STATE_UNKNOWN',code:'BLS_C_SOURCE_CHECKPOINT_INVALID',
    sourceVersion:null,sourceStoredAt:null,cohortRetrievedAt:null,
    newerIncomplete:null,snapshotsVerified:0,seriesVerified:0};
  if(!db||typeof db.prepare!=='function')return fallback;
  try{
    const found=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table' "+
      "AND name IN ('api_history_snapshots_v1','api_history_chunks_v1')")
      .all().map(x=>x.name));
    if(found.size!==2)return none('BLS_C_SNAPSHOT_TABLES_NOT_STORED');
    // Bound the same fixed-series history scan as the approved R3D analyzer.
    const snapshots=db.prepare(
      "SELECT provider,dataset,snapshot_sha256,as_of,retrieved_at,status,history_mode,"+
      "row_count,latest_observation_date,chunk_hashes_json,provenance_json "+
      "FROM api_history_snapshots_v1 WHERE provider='BLS' "+
      "AND dataset IN (?,?,?) ORDER BY retrieved_at DESC LIMIT 501").all(...SERIES);
    if(!snapshots.length)return none('BLS_C_SNAPSHOTS_NOT_STORED');
    if(snapshots.length>500)return fallback;
    const cohorts=new Map();
    let newest='';
    for(const snapshot of snapshots){
      const id=snapshot.dataset;
      if(snapshot.provider!=='BLS'||!SERIES.includes(id)||
        snapshot.status!=='READY_DIRECT_BLS'||snapshot.history_mode!==CONTRACT||
        !utc(snapshot.retrieved_at)||snapshot.as_of!==snapshot.retrieved_at.slice(0,10)||
        !SHA.test(snapshot.snapshot_sha256))stop();
      const hashes=JSON.parse(snapshot.chunk_hashes_json);
      const provenance=JSON.parse(snapshot.provenance_json);
      if(!Array.isArray(hashes)||hashes.length!==1||!SHA.test(hashes[0])||
        provenance?.contract!==CONTRACT||provenance.authority!=='US_BLS'||
        provenance.transportProvider!=='BLS_DIRECT_API'||provenance.seriesID!==id||
        provenance.retrievedAt!==snapshot.retrieved_at||
        !SHA.test(provenance.responseSha256)||provenance.officialVintageId!==null)stop();
      const frequency=id==='PRS85006111'?'QUARTERLY':'MONTHLY';
      if(provenance.frequency!==frequency||provenance.seasonalAdjustment!=='SA'||
        provenance.rawUnit!==(frequency==='MONTHLY'?'INDEX':'PERCENT_YEAR_OVER_YEAR'))stop();
      const identity=JSON.stringify({contract:CONTRACT,provider:'BLS',dataset:id,
        frequency,seasonalAdjustment:'SA',chunks:hashes});
      if(sha(identity)!==snapshot.snapshot_sha256)stop();
      const chunk=db.prepare(
        'SELECT payload_json,row_count,first_observation_date,last_observation_date,first_seen_at '+
        'FROM api_history_chunks_v1 WHERE provider=? AND dataset=? AND chunk_sha256=? LIMIT 1'
      ).get('BLS',id,hashes[0]);
      if(!chunk||typeof chunk.payload_json!=='string'||
        Buffer.byteLength(chunk.payload_json,'utf8')>1_000_000||
        sha(chunk.payload_json)!==hashes[0]||!utc(chunk.first_seen_at)||
        chunk.first_seen_at>snapshot.retrieved_at)stop();
      const raw=JSON.parse(chunk.payload_json);
      if(!Array.isArray(raw)||!raw.length||raw.length>400||
        raw.length!==chunk.row_count||raw.length!==snapshot.row_count||
        raw[0]?.observationDate!==chunk.first_observation_date||
        raw.at(-1)?.observationDate!==chunk.last_observation_date||
        raw.at(-1)?.observationDate!==snapshot.latest_observation_date||
        provenance.periodStart!==chunk.first_observation_date||
        provenance.periodEnd!==chunk.last_observation_date||
        raw.some(item=>item?.seriesID!==id))stop();
      const cohortKey=snapshot.retrieved_at+'|'+provenance.responseSha256;
      const group=cohorts.get(cohortKey)??new Map();
      if(group.has(id))stop();
      group.set(id,{snapshotSha256:snapshot.snapshot_sha256,firstSeenAt:chunk.first_seen_at,
        retrievedAt:snapshot.retrieved_at});
      cohorts.set(cohortKey,group);
      if(newest<snapshot.retrieved_at)newest=snapshot.retrieved_at;
    }
    const complete=[...cohorts.entries()].filter(([,group])=>SERIES.every(id=>group.has(id)));
    if(!complete.length)return {...fallback,code:'BLS_C_COMPLETE_COHORT_NOT_STORED',
      snapshotsVerified:snapshots.length};
    complete.sort((a,b)=>b[0].localeCompare(a[0]));
    const chosen=complete[0][1];
    const identity=[SCHEMA,...SERIES.map(id=>id+'|'+chosen.get(id).snapshotSha256).sort()];
    return {status:'PASS',code:'BLS_C_SOURCE_CHECKPOINT_VERIFIED',
      sourceVersion:sha(identity.join('\n')),
      sourceStoredAt:Math.min(...SERIES.map(id=>Date.parse(chosen.get(id).firstSeenAt))),
      cohortRetrievedAt:chosen.get(SERIES[0]).retrievedAt,
      newerIncomplete:newest>chosen.get(SERIES[0]).retrievedAt,
      snapshotsVerified:snapshots.length,seriesVerified:SERIES.length};
  }catch{return fallback;}
}
