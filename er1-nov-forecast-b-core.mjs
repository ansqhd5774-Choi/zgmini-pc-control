// Isolated fixed-B orchestration candidate; NOT an installed PC entry.
// Actual PC wiring must import `loadSavedNovemberDays` extracted unchanged from
// control `er1-nov30-forecast-shadow.mjs` (#488) and approved public helpers.
// No direct provider requests, SQLite writes, D1 implementation or retries.
const FORECAST_PUBLIC_KEYS=Object.freeze({'2026-11':'market-calendar:earnings-nov2026-er1-score-public'});

export const NOV_FORECAST_B_APPROVAL='ER1_NOV_SAVED_FORECAST_D1_ONLY';
export const NOV_FORECAST_PUBLIC_KEY=FORECAST_PUBLIC_KEYS['2026-11'];
const stop=code=>{throw Error(code)};
const SHA40=/^[0-9a-f]{40}$/;

/**
 * One B-request execution, with dependencies injected by the fixed control
 * entry. The source SHA, local store and remote helpers are host-approved.
 */
export async function runNovemberForecastB({approval,sourceSha,asOf,
  loadSavedNovemberDays,adapter,scorer,publicSerializer,saveDerived,
  syncD1,remote,core,prepareForecastMonth,stageForecastMonth,
  publishForecastMonth,clock=Date.now}={}){
  const report={schema:'ZGMINI_ER1_NOV_FORECAST_B_RESULT_V1',status:'BLOCKED',
    code:'ER1_NOV_FORECAST_B_NOT_STARTED',month:'2026-11',
    publicKey:NOV_FORECAST_PUBLIC_KEY,providerCalls:0,coreWrites:0,
    schedulerWrites:0,writerWrites:0,rawRowsPublic:0,d1Writes:0};
  let staged=false,publishing=false;
  try{
    if(!SHA40.test(sourceSha)||
      approval?.scope!==NOV_FORECAST_B_APPROVAL||
      approval?.sourceSha!==sourceSha||
      approval?.month!=='2026-11'||
      approval?.outputKey!==NOV_FORECAST_PUBLIC_KEY||
      approval?.maxProviderCalls!==0||
      approval?.allowCoreWrites!==false||
      approval?.maxD1Writes!==1||
      typeof asOf!=='string'||asOf<'2026-11-01'||asOf>'2026-11-30'||
      syncD1?.publicKey!==NOV_FORECAST_PUBLIC_KEY||
      typeof syncD1.run!=='function'||[
        loadSavedNovemberDays,adapter,scorer,publicSerializer,saveDerived,
        prepareForecastMonth,stageForecastMonth,publishForecastMonth,
        clock].some(fn=>typeof fn!=='function'))
      stop('ER1_NOV_FORECAST_B_APPROVAL_STOP');
    const input=await loadSavedNovemberDays();
    if(!input||!Array.isArray(input.savedDays))
      stop('ER1_NOV_FORECAST_B_LOADER_STOP');
    const prepared=prepareForecastMonth({month:'2026-11',asOf,
      savedDays:input.savedDays,adapter,scorer,publicSerializer});
    if(prepared.publicKey!==NOV_FORECAST_PUBLIC_KEY||
      prepared.providerCalls!==0||prepared.rawRowsPublic!==0)
      stop('ER1_NOV_FORECAST_B_KEY_STOP');
    report.inputDays=input.savedDays.length;
    report.estimatedIssuers=prepared.scoreableIssuers;
    report.missingOneStar=prepared.missingOneStar;
    report.star3Count=prepared.star3Count;
    report.sourceStoredAt=prepared.sourceStoredAt;
    report.derivedSha256=prepared.bodySha256;
    const receipt=await stageForecastMonth(prepared,{saveDerived});
    staged=true;report.status='PENDING';
    // The B manifest pins the November helper's publicKey before any effects.
    // The host wiring must bind syncD1.run to the existing Nov-only helper.
    publishing=true;
    const published=await publishForecastMonth(prepared,receipt,{
      approvedB:true,approvedBodySha256:receipt.bodySha256,
      syncD1,remote,core,storedAt:clock()});
    if(published.publicKey!==NOV_FORECAST_PUBLIC_KEY||
      published.d1Writes>1||published.providerCalls!==0)
      stop('ER1_NOV_FORECAST_B_EFFECT_STOP');
    report.d1Writes=published.d1Writes;
    report.status='PASS';report.code=published.code;
    report.d1ReadbackSha256=published.bodySha256;
  }catch(error){
    report.status=publishing?'STATE_UNKNOWN':staged?'PENDING':'BLOCKED';
    report.code=/^ER1_(NOV_)?FORECAST_[A-Z0-9_]+$/.test(error?.message??'')?
      error.message:'ER1_NOV_FORECAST_B_UNKNOWN_STOP';
  }
  return report;
}
