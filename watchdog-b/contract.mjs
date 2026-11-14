// Fixed approval contract for upgrading the independent watchdog from a
// standard PC Runner B lane. This NEVER executes maintainer self-handoff.
export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const ISSUE_TITLE='pc-watchdog-b-upgrade';
export const OP='watchdog-b-upgrade';
export const REQUEST_SCHEMA='ZGMINI_PC_WATCHDOG_B_REQUEST_V1';
export const MANIFEST_SCHEMA='ZGMINI_PC_WATCHDOG_B_MANIFEST_V1';
export const SCOPE='CONTROL_WATCHDOG_HANDOFF_BRIDGE_B_V1';
export const INITIAL_SCOPE='RUNNER_RECOVERY_ONLY';
export const FINAL_SCOPE='RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1';
export const TARGET='d01229adacc3c23f50bb119d146e291ff7e15012';
export const ORIGINAL='8c50a37274976e640747b0d378ef64c063b3e0b57b2a68a5f5e6f9137c659bce';
export const REPLACEMENT='d0d788996c15a94dcd1db540b9c624f950b3ce827589fdadc56a593f1b71cfc8';
const sha=/^[0-9a-f]{64}$/;
const id=/^pc-watchdog-b-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const error=code=>Object.assign(new Error(code),{code});
export const exact=(value,keys)=>value!==null&&typeof value==='object'
 &&!Array.isArray(value)&&Object.keys(value).length===keys.length
 &&keys.every(key=>Object.hasOwn(value,key));
export function parseCanonicalBody(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>2048)throw error('WATCHDOG_B_REQUEST_BODY_INVALID');
 let body;try{body=JSON.parse(raw);}catch{throw error('WATCHDOG_B_REQUEST_BODY_INVALID');}
 // No last-key-wins aliases, duplicates, whitespace tricks or extra commands.
 if(raw.trim()!==JSON.stringify(body))throw error('WATCHDOG_B_REQUEST_NONCANONICAL');
 return body;
}
export function validateRequest(event,body,approval,installed,sourceDigest,approvalDigest){
 if(event?.action!=='opened'||event?.repository?.full_name!==REPO
   ||event.repository.private!==true||event?.sender?.login!=='ansqhd5774-Choi'
   ||event?.issue?.user?.login!=='ansqhd5774-Choi'
   ||event?.issue?.title!==ISSUE_TITLE
   ||!Array.isArray(event.issue.labels)
   ||!event.issue.labels.some(item=>item?.name==='pc-maintenance'))
   throw error('WATCHDOG_B_UNTRUSTED_EVENT');
 if(!exact(body,['schema','requestId','operation','targetSha','approvalManifestSha256'])
   ||body.schema!==REQUEST_SCHEMA||body.operation!==OP
   ||!id.test(body.requestId??'')||body.targetSha!==TARGET
   ||!sha.test(body.approvalManifestSha256??''))
   throw error('WATCHDOG_B_REQUEST_CONTRACT');
 if(!exact(approval,['schema','approved','scope','installedSha256','targetSha',
   'targetSha256','fromScope','toScope','allowedFiles','operation','approvalBasis'])
   ||approval.schema!==MANIFEST_SCHEMA||approval.approved!==true
   ||approval.scope!==SCOPE||approval.operation!==OP
   ||approval.targetSha!==TARGET||approval.installedSha256!==ORIGINAL
   ||approval.targetSha256!==REPLACEMENT
   ||approval.fromScope!==INITIAL_SCOPE||approval.toScope!==FINAL_SCOPE
   ||JSON.stringify(approval.allowedFiles)!==JSON.stringify([
       'pc-watchdog/runner-watchdog.mjs','pc-watchdog/INSTALL.json'])
   ||!sha.test(approvalDigest??'')
   ||approvalDigest!==body.approvalManifestSha256
   ||sourceDigest!==REPLACEMENT)
   throw error('WATCHDOG_B_APPROVAL_MISMATCH');
 if(!installed||installed.scope!==INITIAL_SCOPE||installed.sha256!==ORIGINAL
   ||!sha.test(installed.startupSha256??'')
   ||!sha.test(installed.priorStartupSha256??''))
   throw error('WATCHDOG_B_INSTALLED_PREIMAGE_MISMATCH');
 return Object.freeze({requestId:body.requestId,issueNumber:event.issue.number,targetSha:TARGET});
}
export function decideUpgradeState({existingClaim,installedDigest,expectedDigest,
  status,owner,ownerAlive,now=Date.now()}={}){
 if(existingClaim)return 'DUPLICATE_BLOCK';
 if(installedDigest!==expectedDigest)return 'SOURCE_DRIFT_BLOCK';
 if(status?.state!=='HEALTHY'||status.pid!==owner?.pid
   ||typeof status.at!=='string'||!Number.isFinite(Date.parse(status.at))
   ||now-Date.parse(status.at)<0||now-Date.parse(status.at)>90000
   ||ownerAlive!==true)return 'WATCHDOG_NOT_HEALTHY_BLOCK';
 return 'READY';
}
