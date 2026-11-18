// Advisory ordering only. Never treats a heuristic score as verified severity,
// grants execution rights, or bypasses any authenticated handoff gate.
import {parseHandoff,routeHandoff} from './contract.mjs';

export const PRIORITY_POLICY=Object.freeze({
  version:'HANDOFF_PRIORITY_ADVISORY_R1',
  kindWeight:Object.freeze({
    COMMON_CONTROLLER:52,COMMON_RUNNER:47,COMMON_WRITER:42,FEATURE:30
  }),
  checkpointWeight:Object.freeze({
    INSTALL:8,D1:8,STORE:8,COLLECT:6,CALCULATE:6,
    SOURCE:5,API:5,UI:4,OTHER:0
  }),
  agingHours:Object.freeze([6,24,72]),
  agingPoints:Object.freeze([2,5,8])
});

export function parseGitHubTime(value){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value))
    return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)&&new Date(ms).getUTCFullYear()>=2020?ms:null;
}

export function hoursSince(timestamp,nowMs){
  if(!Number.isFinite(nowMs))throw Error('HANDOFF_PRIORITY_CLOCK_INVALID');
  const ms=parseGitHubTime(timestamp);
  if(ms===null||ms>nowMs+60000)return null;
  return Math.max(0,Math.floor((nowMs-ms)/3600000));
}

export function assessPriority(issue,nowMs=Date.now()){
  if(!Number.isFinite(nowMs))throw Error('HANDOFF_PRIORITY_CLOCK_INVALID');
  let handoff;
  try{handoff=parseHandoff(issue?.body);}catch{
    return Object.freeze({score:0,band:'UNVERIFIED',role:'UNVERIFIED',
      ageHours:hoursSince(issue?.created_at,nowMs),reason:'INVALID_INCIDENT_CONTRACT'});
  }
  const kind=handoff.failure.kind,checkpoint=handoff.origin.checkpoint;
  const weight=PRIORITY_POLICY.kindWeight[kind]||0;
  const stage=PRIORITY_POLICY.checkpointWeight[checkpoint]||0;
  const ageHours=hoursSince(issue?.created_at,nowMs);
  const aging=ageHours===null?0:ageHours>=72?8:ageHours>=24?5:ageHours>=6?2:0;
  // Exact error classes only. Unstructured message text is never interpreted.
  const recovery=handoff.failure.code.endsWith('RECOVERY_REQUIRED')||
    handoff.failure.code==='BACKLOG_OR_RECOVERY_NOT_VERIFIED'?9:0;
  const score=weight+stage+aging+recovery;
  const band=score>=68?'P1_REVIEW':score>=52?'P2_REVIEW':
    score>=40?'P3_REVIEW':'P4_REVIEW';
  return Object.freeze({score,band,role:routeHandoff(handoff).role,
    ageHours,reason:'KIND_STAGE_AGE_CLASS_POLICY',kind,checkpoint,
    agingPoints:aging,policy:PRIORITY_POLICY.version,
    // Proof of cause/urgency requires the responsible owner's investigation.
    operationalSeverityVerified:false});
}

export function sortAdvisoryQueue(issues,nowMs=Date.now()){
  if(!Array.isArray(issues)||issues.length>500)throw Error('HANDOFF_PRIORITY_INVENTORY_INVALID');
  const seen=new Set();
  const ranked=issues.map(issue=>{
    if(!Number.isSafeInteger(issue?.number)||issue.number<1||seen.has(issue.number))
      throw Error('HANDOFF_PRIORITY_IDENTITY_STOP');
    seen.add(issue.number);
    return {issue,priority:assessPriority(issue,nowMs)};
  });
  ranked.sort((a,b)=>b.priority.score-a.priority.score||
    (b.priority.ageHours??-1)-(a.priority.ageHours??-1)||
    a.issue.number-b.issue.number);
  return ranked.map(x=>x.issue);
}
