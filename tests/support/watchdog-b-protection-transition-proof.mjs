// Independent support only. Pure in-memory comparison for #1374; NOT an
// authorization, Windows reader, baseline updater, or Watchdog B retry path.
const KEYS=Object.freeze({
  'ZGMINI-PC-Local-Core':'CORE_TASK_XML',
  'ZGMINI-PC-Local-Korea':'KOREA_TASK_XML',
  'ZGMINI-PC-Iran-Progress-R13':'RETIRED_IRAN_TASK',
  'E:/ZGmini/data/pc-writer/config.json':'WRITER_CONFIG',
  'E:/ZGmini/data/pc-writer/quota-runner.cmd':'WRITER_QUOTA_RUNNER',
  'E:/ZGmini/data/pc-writer/run-local.cmd':'WRITER_RUN_LOCAL',
  'E:/ZGmini/automation/pc-control/host.json':'CONTROLLER_HOST'
});
const MANDATORY=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea','ZGMINI-PC-Iran-Progress-R13'];
const ALLOWED=new Set(Object.values(KEYS));
const REQ='pc-watchdog-a-c3f812e2-6e11-4ec2-b6b7-f968174f38a9';
const RUN='43632362343';
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>isRecord(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const result=(status,blockers,changes=[])=>({schema:'ZGMINI_WATCHDOG_B_TRANSITION_AUDIT_V1',
  status,failedIssueNumber:1372,readbackRunId:RUN,changedCategories:changes,
  blockers:[...new Set(blockers)].sort(),operationalWrites:0,baselineUpdated:false,
  approvedForInstall:false});
// Input snapshots must stay on the already-authorized Windows host. This
// method returns only category names / fixed reason codes, never their values.
export function auditProtectedTransition({before,now,readback,proposal}={}){
  if(!isRecord(before)||!isRecord(now)||!isRecord(readback))
    return result('UNVERIFIED',['INPUT_SCHEMA_INVALID']);
  const union=new Set([...Object.keys(before),...Object.keys(now)]);
  if([...union].some(k=>!Object.hasOwn(KEYS,k))||MANDATORY.some(k=>!Object.hasOwn(before,k)||!Object.hasOwn(now,k)))
    return result('UNVERIFIED',['PROTECTION_SCHEMA_INVALID']);
  if([...union].some(k=> (Object.hasOwn(before,k)&&typeof before[k]!=='string') ||
    (Object.hasOwn(now,k)&&typeof now[k]!=='string')))
    return result('UNVERIFIED',['PROTECTION_VALUE_TYPE_INVALID']);
  const actual=[...union].filter(k=>before[k]!==now[k]).map(k=>({
    category:KEYS[k],change:!Object.hasOwn(before,k)?'ADDED':
      !Object.hasOwn(now,k)?'MISSING':'CHANGED',key:k
  })).sort((a,b)=>a.category.localeCompare(b.category));
  const changed=actual.map(({category,change})=>({category,change}));
  if(readback.schema!=='ZGMINI_PC_WATCHDOG_PROTECTED_DRIFT_A_RESULT_V1'||
     readback.requestId!==REQ||readback.failedIssueNumber!==1372||
     String(readback.runId)!==RUN||readback.status!=='PASS'||
     readback.code!=='WATCHDOG_A_PROTECTED_KEYS_CHANGED'||
     readback.writes!==0||readback.providerCalls!==0||readback.d1Writes!==0||
     !Array.isArray(readback.changed)||readback.changedCount!==changed.length||
     JSON.stringify([...readback.changed].sort((a,b)=>String(a.category).localeCompare(String(b.category))))!==JSON.stringify(changed))
    return result('UNVERIFIED',['LIVE_READBACK_MISMATCH'],changed);
  if(now['ZGMINI-PC-Iran-Progress-R13']!=='APPROVED_RETIRED_ABSENT')
    return result('UNVERIFIED',['RETIRED_IRAN_ABSENCE_NOT_PROVEN'],changed);
  if(!isRecord(proposal)||proposal.schema!=='ZGMINI_WATCHDOG_B_TRANSITION_PROPOSAL_V1'||
     proposal.failedIssueNumber!==1372||proposal.readbackRunId!==RUN||
     !Array.isArray(proposal.transitions))
    return result('OWNER_EVIDENCE_REQUIRED',['PROPOSAL_MISSING_OR_INVALID'],changed);
  const blockers=[],used=new Set();
  for(const t of proposal.transitions){
    if(!isRecord(t)||!ALLOWED.has(t.category)||used.has(t.category)||
       !exact(t,['category','change','expectedBefore','expectedAfter','approvalRef','receiptRef'])){
      blockers.push('TRANSITION_SCHEMA_OR_DUPLICATE');continue;
    }
    used.add(t.category);
    const source=actual.find(c=>c.category===t.category);
    if(!source||source.change!==t.change){blockers.push('TRANSITION_NOT_IN_LIVE_DRIFT');continue;}
    if(t.expectedBefore!==(Object.hasOwn(before,source.key)?before[source.key]:null)||
       t.expectedAfter!==(Object.hasOwn(now,source.key)?now[source.key]:null))
      blockers.push('TRANSITION_PREIMAGE_OR_POSTIMAGE_MISMATCH');
    if(typeof t.approvalRef!=='string'||!/^#[1-9]\d{0,6}$/.test(t.approvalRef)||
       typeof t.receiptRef!=='string'||!/^#[1-9]\d{0,6}$/.test(t.receiptRef))
      blockers.push('SOURCE_APPROVAL_OR_RECEIPT_REFERENCE_MISSING');
  }
  if(used.size!==actual.length)blockers.push('UNEXPLAINED_PROTECTED_CATEGORY');
  if(blockers.length)return result('OWNER_EVIDENCE_REQUIRED',blockers,changed);
  // Only demonstrates that candidate transition claims exactly match the
  // locally observed snapshots. No GitHub signature, scope, owner, timestamp,
  // manifest or permission is authenticated by this pure function.
  return result('LOCAL_MATCH_OWNER_AUTHENTICATION_REQUIRED',[],changed);
}
