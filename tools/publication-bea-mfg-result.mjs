// Strict stdout-only adapter for the fixed archived BEA manufacturing B publisher.
// No provider calls, filesystem writes, D1 requests, or arbitrary subprocess arguments.
const SHA=/^[a-f0-9]{64}$/;
const QUARTER=/^\d{4}-Q[1-4]$/;
const keys=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).length===fields.length
  &&fields.every(k=>Object.hasOwn(value,k));
const PREFLIGHT=['status','sourceVersion','sourceStoredAt','period','yoyPercent',
  'rawWrites','sqliteWrites','d1Writes'];
const APPLY=['status','key','sourceVersion','sourceStoredAt','period','yoyPercent',
  'sqliteWrites','scoreWrites','storedAt','d1Readback'];
const integer=x=>Number.isSafeInteger(x)&&x>0;

export function parseBeaMfgResult(stdout,{phase,expectedSha,expectedKey,preflight}={}){
  if(typeof stdout!=='string'||Buffer.byteLength(stdout)>8192||!SHA.test(expectedSha??''))
    throw Error('PUBLICATION_BEA_MFG_RESULT_INVALID');
  let value;
  try{value=JSON.parse(stdout.trim());}
  catch{throw Error('PUBLICATION_BEA_MFG_RESULT_INVALID');}
  const fields=phase==='PREFLIGHT'?PREFLIGHT:phase==='APPLY'?APPLY:null;
  if(!fields||!keys(value,fields)
    ||value.sourceVersion!==expectedSha||!integer(value.sourceStoredAt)
    ||!QUARTER.test(value.period)
    ||typeof value.yoyPercent!=='number'||!Number.isFinite(value.yoyPercent)
    ||value.sqliteWrites!==0)
    throw Error('PUBLICATION_BEA_MFG_RESULT_INVALID');
  if(phase==='PREFLIGHT'){
    if(value.status!=='PASS_READONLY_ARCHIVE_PREFLIGHT'
      ||value.rawWrites!==0||value.d1Writes!==0)
      throw Error('PUBLICATION_BEA_MFG_PREFLIGHT_INVALID');
    return Object.freeze({sourceVersion:value.sourceVersion,
      sourceStoredAt:value.sourceStoredAt,period:value.period,yoyPercent:value.yoyPercent});
  }
  if(value.key!==expectedKey||value.scoreWrites!==0
    ||!['READBACK_VERIFIED','ALREADY_STORED'].includes(value.status)
    ||value.d1Readback!==value.status
    ||!integer(value.storedAt)||value.storedAt<value.sourceStoredAt
    ||!preflight
    ||value.sourceStoredAt!==preflight.sourceStoredAt
    ||value.sourceVersion!==preflight.sourceVersion
    ||value.period!==preflight.period||value.yoyPercent!==preflight.yoyPercent)
    throw Error('PUBLICATION_BEA_MFG_APPLY_INVALID');
  return Object.freeze({status:'PASS',key:value.key,
    d1Result:value.status,sourceVersion:value.sourceVersion,
    sourceStoredAt:value.sourceStoredAt,storedAt:value.storedAt});
}
