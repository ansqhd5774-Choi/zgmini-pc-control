// A NEW, NARROW B operation proposal. PURE: NO filesystem/network/shell I/O.
// NEVER route through existing source-only writer-b without separate approval.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {selectPinnedCapabilityProfiles} from
 '../../controller/approved-runtime-inventory-readonly.mjs';
import {selectPinnedBundleProfiles} from './pinned-bundle-profiles.mjs';
import {isWriterBRequestId} from './writer-b-request-id.mjs';

export const PIN_CAS_SCHEMA='ZGMINI_PC_RUNTIME_PIN_AND_REGISTRY_CAS_B_V1';
export const PIN_CAS_SCOPE='HOST_RUNTIME_PIN_AND_REGISTRY_BYTE_CAS_ONLY';
export const RUNTIME_REGISTRY_SCHEMA='ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1';
const SHA64=/^[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
const digest=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{const e=Error(code);e.code=code;throw e;};
const need=(yes,code)=>{if(!yes)fail(code);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function exactFields(x,names,code){
 need(obj(x)&&Object.keys(x).sort().join('|')===[...names].sort().join('|'),code);
}
function strictUtf8(raw,code){
 need(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<=1048576,code);
 const s=raw.toString('utf8');
 need(Buffer.from(s,'utf8').equals(raw),code);
 return s;
}
function parseObject(raw,code){
 let value;
 const text=strictUtf8(raw,code);
 try{value=JSON.parse(text);}catch{fail(code);}
 need(obj(value),code);
 return {text,value};
}
function skipWs(text,i){while(i<text.length&&/\s/.test(text[i]))i++;return i;}
function stringEnd(text,i){
 need(text[i]==='"','B_JSON_STRING_SCAN');
 let escaped=false;
 for(let j=i+1;j<text.length;j++){
  if(escaped){escaped=false;continue;}
  if(text[j]==='\\'){escaped=true;continue;}
  if(text[j]==='"')return j+1;
 }
 fail('B_JSON_STRING_SCAN');
}
function valueEnd(text,i){
 let depth=0,inside=false,escape=false;
 for(let j=i;j<text.length;j++){
  const ch=text[j];
  if(inside){
   if(escape){escape=false;continue;}
   if(ch==='\\'){escape=true;continue;}
   if(ch==='"')inside=false;
   continue;
  }
  if(ch==='"'){inside=true;continue;}
  if(ch==='['||ch==='{'){depth++;continue;}
  if(ch===']'||ch==='}'){
   if(depth===0)return j;
   depth--;continue;
  }
  if(ch===','&&depth===0)return j;
 }
 return text.length;
}
// Scans exact top-level key/value character spans without interpreting
// braces, quotes or escaped Unicode inside nested JSON string values.
function topLevelMembers(text){
 const members=[];
 let i=skipWs(text,0);
 need(text[i]==='{','B_JSON_TOP_LEVEL');
 i++;
 for(;;){
  i=skipWs(text,i);
  if(text[i]==='}')return {members,close:i};
  const keyStart=i,keyFinish=stringEnd(text,i);
  let key;
  try{key=JSON.parse(text.slice(keyStart,keyFinish));}catch{fail('B_JSON_KEY');}
  need(typeof key==='string','B_JSON_KEY');
  i=skipWs(text,keyFinish);
  need(text[i]===':','B_JSON_SEPARATOR');
  i=skipWs(text,i+1);
  const valueStart=i;
  const boundary=valueEnd(text,i);
  let valueFinish=boundary;
  while(valueFinish>valueStart&&/\s/.test(text[valueFinish-1]))valueFinish--;
  members.push({key,valueStart,valueFinish});
  i=skipWs(text,boundary);
  if(text[i]===','){i++;continue;}
  need(text[i]==='}','B_JSON_SEPARATOR');
  return {members,close:i};
 }
}
function uniqueKeys(members){
 const lower=members.map(x=>x.key.toLowerCase());
 need(new Set(lower).size===lower.length,'B_JSON_DUPLICATE_KEY');
}
const strip=(value,key)=>Object.fromEntries(
 Object.entries(value).filter(([k])=>k!==key));
const isSha=x=>SHA64.test(x??'');
const equalSha=(raw,approved,code)=>need(
 raw===null?approved===null:Buffer.isBuffer(raw)&&digest(raw)===approved,code);

/**
 * Preserve every existing host.json byte outside one TOP-LEVEL PIN JSON
 * value. An absent field can be added only if independently approved.
 * This function neither reads nor writes operational host.json.
 */
export function patchHostRuntimePinBytes(beforeRaw,{oldPin,newPin}){
 need(isSha(newPin)&&(oldPin===null||isSha(oldPin))&&oldPin!==newPin,'B_PIN_VALUES');
 const {text,value:before}=parseObject(beforeRaw,'B_HOST_JSON');
 const {members,close}=topLevelMembers(text);
 uniqueKeys(members);
 const matches=members.filter(m=>m.key.toLowerCase()==='approvedruntimeinventorysha256');
 need(matches.length<=1&&(!matches.length||matches[0].key==='approvedRuntimeInventorySha256'),
  'B_PIN_KEY_CASE');
 const current=Object.hasOwn(before,'approvedRuntimeInventorySha256')
  ?before.approvedRuntimeInventorySha256:null;
 need(current===oldPin,'B_PIN_PREIMAGE');
 let afterText;
 if(matches.length===1){
  const {valueStart,valueFinish}=matches[0];
  need(text.slice(valueStart,valueFinish)===JSON.stringify(oldPin),
   'B_PIN_TOKEN_PREIMAGE');
  afterText=text.slice(0,valueStart)+JSON.stringify(newPin)+text.slice(valueFinish);
 }else{
  need(oldPin===null,'B_PIN_MISSING_PREIMAGE');
  const prefix=Object.keys(before).length?',':'';
  afterText=text.slice(0,close)+prefix+
   JSON.stringify('approvedRuntimeInventorySha256')+':'+JSON.stringify(newPin)+
   text.slice(close);
 }
 const raw=Buffer.from(afterText,'utf8');
 const {value:after}=parseObject(raw,'B_HOST_AFTER_JSON');
 need(after.approvedRuntimeInventorySha256===newPin&&
  isDeepStrictEqual(strip(before,'approvedRuntimeInventorySha256'),
   strip(after,'approvedRuntimeInventorySha256')),'B_HOST_OTHER_FIELDS_DRIFT');
 // Whole-host byte rewrite is allowed only as a one-field exact-CAS artifact;
 // input bytes outside the precise insertion/value span stay untouched.
 return raw;
}

/** Check one selected A/B profile in the common pinned registry.
 * If the installed registry is genuinely absent (not an I/O error), the
 * first approved registration may create one; no fake empty-file preimage.
 */
function arrayElements(source){
 let i=skipWs(source,0);
 need(source[i]==='[','B_REGISTRY_ARRAY');
 i++;const elements=[];
 for(;;){
  i=skipWs(source,i);
  if(source[i]===']')return {elements,close:i};
  const start=i,boundary=valueEnd(source,i);
  let end=boundary;
  while(end>start&&/\s/.test(source[end-1]))end--;
  let value;
  try{value=JSON.parse(source.slice(start,end));}catch{fail('B_REGISTRY_ARRAY');}
  need(obj(value)&&typeof value.id==='string','B_REGISTRY_PROFILE');
  elements.push({start,end,value});
  i=skipWs(source,boundary);
  if(source[i]===','){i++;continue;}
  need(source[i]===']','B_REGISTRY_ARRAY');
  return {elements,close:i};
 }
}
function registryProfileRawDiff(beforeText,next){
 const top=topLevelMembers(beforeText);
 uniqueKeys(top.members);
 const profileMember=top.members.find(x=>x.key==='profiles');
 need(!!profileMember,'B_REGISTRY_PROFILES_ABSENT');
 const span=beforeText.slice(profileMember.valueStart,profileMember.valueFinish);
 const {elements,close}=arrayElements(span);
 need(new Set(elements.map(x=>x.value.id.toLowerCase())).size===elements.length,
  'B_REGISTRY_PROFILE_DUPLICATE');
 const found=elements.find(x=>x.value.id===next.id);
 const afterProfile=JSON.stringify(next);
 const replacement=found?
  span.slice(0,found.start)+afterProfile+span.slice(found.end):
  elements.length?
   span.slice(0,elements[elements.length-1].end)+','+afterProfile+
    span.slice(elements[elements.length-1].end):
   span.slice(0,close)+afterProfile+span.slice(close);
 return beforeText.slice(0,profileMember.valueStart)+replacement+
  beforeText.slice(profileMember.valueFinish);
}
export function verifyRegistryEntryOnly(beforeRaw,afterRaw,{
 entryKey,beforeEntrySha256,afterEntrySha256,sourceSha,
}){
 const bootstrapping=beforeRaw===null;
 const before=bootstrapping?
  {schema:RUNTIME_REGISTRY_SCHEMA,profiles:[]}:
  parseObject(beforeRaw,'B_REGISTRY_JSON').value;
 const after=parseObject(afterRaw,'B_REGISTRY_AFTER_JSON').value;
 need(/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(entryKey),'B_REGISTRY_KEY');
 need(before.schema===RUNTIME_REGISTRY_SCHEMA&&after.schema===RUNTIME_REGISTRY_SCHEMA&&
  Array.isArray(before.profiles)&&Array.isArray(after.profiles)&&
  Object.keys(before).sort().join('|')===Object.keys(after).sort().join('|')&&
  isDeepStrictEqual(strip(before,'profiles'),strip(after,'profiles')),
  'B_REGISTRY_SCHEMA_DRIFT');
 need(after.profiles.every(x=>obj(x)&&typeof x.id==='string')&&
  new Set(after.profiles.map(x=>x.id.toLowerCase())).size===after.profiles.length,
  'B_REGISTRY_PROFILE_DUPLICATE');
 const prevOther=before.profiles.filter(x=>x?.id!==entryKey);
 const afterOther=after.profiles.filter(x=>x?.id!==entryKey);
 need(isDeepStrictEqual(prevOther,afterOther),'B_REGISTRY_OTHER_ENTRIES_DRIFT');
 const prevMatches=before.profiles.filter(x=>x?.id===entryKey);
 const nextMatches=after.profiles.filter(x=>x?.id===entryKey);
 need(prevMatches.length<=1&&nextMatches.length===1,'B_REGISTRY_PROFILE_CARDINALITY');
 const previous=prevMatches[0]??null,next=nextMatches[0];
 need(!bootstrapping||beforeEntrySha256===null,'B_REGISTRY_BOOTSTRAP_PREIMAGE');
 need(obj(next)&&next.id===entryKey&&obj(next.binding)&&
  next.binding.sourceSha===sourceSha&&
  next.binding.sourceRepository==='ansqhd5774-Choi/zgmini'&&
  typeof next.binding.sourceBranch==='string'&&
  /^[a-z0-9/_-]{1,128}$/i.test(next.binding.sourceBranch)&&
  Object.keys(next.binding).sort().join('|')===
   ['sourceRepository','sourceBranch','sourceSha'].sort().join('|'),
  'B_REGISTRY_SOURCE_BINDING');
 if(next.bundleProfile!==undefined){
  need(obj(next.bundleProfile)&&next.bundleProfile.id===entryKey,
   'B_REGISTRY_BUNDLE_PROFILE_BINDING');
 }
 need((previous===null?null:digest(Buffer.from(JSON.stringify(previous))))===beforeEntrySha256,
  'B_REGISTRY_ENTRY_PREIMAGE');
 need(digest(Buffer.from(JSON.stringify(next)))===afterEntrySha256,
  'B_REGISTRY_ENTRY_TARGET');
 // Parse the same approved bytes through the official A schema validator
 // BEFORE B mutation. This prevents B registration of a malformed A profile.
 if(!bootstrapping&&before.profiles.length>0){
  const first=before.profiles[0];
  selectPinnedCapabilityProfiles({manifestBytes:beforeRaw,
   approvedManifestSha256:digest(beforeRaw),requestIdentity:first.binding});
 }
 selectPinnedCapabilityProfiles({manifestBytes:afterRaw,
  approvedManifestSha256:digest(afterRaw),requestIdentity:next.binding});
 if(next.bundleProfile!==undefined){
  const b=selectPinnedBundleProfiles({manifestBytes:afterRaw,
   approvedManifestSha256:digest(afterRaw),requestIdentity:next.binding});
  need(Object.hasOwn(b.trustedProfiles,next.id),'B_REGISTRY_BUNDLE_PROFILE_BINDING');
 }
 // Bytes of EVERY non-target profile, other registry field, whitespace and
 // unrelated secret are preserved exactly, not merely semantic JSON equality.
 if(!bootstrapping){
  const expected=registryProfileRawDiff(beforeRaw.toString('utf8'),next);
  need(Buffer.from(expected,'utf8').equals(afterRaw),
   'B_REGISTRY_UNRELATED_BYTES_DRIFT');
 }else need(after.profiles.length===1,'B_REGISTRY_BOOTSTRAP_EXTRA_PROFILES');
 return true;
}

function validateApproval(approval,rawBytes,pin){
 exactFields(approval,['schema','status','scope','profileId','sourceSha',
  'hostBeforeSha256','hostAfterSha256','oldPin','newPin',
  'registryBeforeSha256','registryAfterSha256','registryEntryKey',
  'registryEntryBeforeSha256','registryEntryAfterSha256'],'B_PIN_APPROVAL_FIELDS');
 need(approval.schema===PIN_CAS_SCHEMA&&approval.status==='APPROVED_B'&&
  approval.scope===PIN_CAS_SCOPE,'B_PIN_SCOPE');
 need(SHA40.test(approval.sourceSha)&&
  [approval.hostBeforeSha256,approval.hostAfterSha256,
   approval.registryAfterSha256,
   approval.registryEntryAfterSha256,approval.newPin].every(isSha)&&
  (approval.registryBeforeSha256===null||isSha(approval.registryBeforeSha256))&&
  (approval.oldPin===null||isSha(approval.oldPin))&&
  (approval.registryEntryBeforeSha256===null||
   isSha(approval.registryEntryBeforeSha256)),'B_PIN_APPROVAL_SHA');
 need(approval.profileId===approval.registryEntryKey&&
  /^[a-z0-9][a-z0-9_-]{1,63}$/i.test(approval.profileId),
  'B_PIN_PROFILE_BINDING');
 need(approval.newPin===approval.registryAfterSha256&&
  // Never auto-adopt an orphaned, unpinned registry: doing so would trust
  // every existing profile, not merely the new approved entry. Orphan
  // reconciliation requires a different recovery scope and full review.
  approval.oldPin===approval.registryBeforeSha256,
  'B_PIN_REGISTRY_DIGEST_BINDING');
 need(isWriterBRequestId(pin?.requestId),
  'B_PIN_REQUEST_ID');
 // Actual paths are resolved by the installed Receiver, never from Issue or
 // this plan. No second per-content trusted-profile registry exists.
 need(pin?.profileId===approval.profileId&&
  pin?.sourceSha===approval.sourceSha&&isSha(pin.rawApprovalSha256)&&
  digest(rawBytes)===pin.rawApprovalSha256,'B_PIN_APPROVAL_AUTH_DRIFT');
 return {id:approval.profileId,
  hostTargetId:'INSTALLED_CONTROLLER_HOST',
  registryTargetId:'INSTALLED_RUNTIME_APPROVAL_REGISTRY'};
}
const errCode=e=>typeof e?.code==='string'&&/^B_[A-Z0-9_]{1,110}$/.test(e.code)?
 e.code:'B_PIN_ADAPTER_UNEXPECTED';

/**
 * Pure state machine. adapter must be created only by a separately approved
 * common Writer B receiver. Running this helper does NOT confer approval.
 */
export async function runApprovedRegistryCas({
 approvalRaw,pinnedApproval,adapter,
}={}){
 let phase='INIT',lock=null,backup=null,mutating=false,committed=false,retain=false;
 let profile=null,approval=null,before=null,plan=null,status='BLOCKED',code=null;
 const stages=[];let rollback=null,reportStatus='NOT_ATTEMPTED';
 try{
  need(Buffer.isBuffer(approvalRaw)&&approvalRaw.length<=65536,'B_PIN_RAW_APPROVAL');
  try{approval=JSON.parse(strictUtf8(approvalRaw,'B_PIN_RAW_APPROVAL'));}catch{
   fail('B_PIN_APPROVAL_JSON');
  }
  profile=validateApproval(approval,approvalRaw,pinnedApproval);
  const required=[
   'authenticatePinnedApproval','inspectPreimage','acquireSharedWriterLock',
   'verifyPreimageUnderLock','verifyApprovedRegistryParentUnderLock',
   'loadApprovedRegistryAfterBytes',
   'backupBoth','casHost','casRegistry','readBack','commit',
   'restoreRegistry','restoreHost','verifyRestored',
   'releaseSharedWriterLock','recordResult',
  ];
  need(required.every(k=>typeof adapter?.[k]==='function'),'B_PIN_ADAPTER_INCOMPLETE');
  phase='AUTHORIZE';
  const auth=await adapter.authenticatePinnedApproval({
   pin:pinnedApproval,sha256:digest(approvalRaw),scope:PIN_CAS_SCOPE});
  need(auth?.verified===true&&auth.sha256===digest(approvalRaw),'B_PIN_AUTH_FAILED');
  stages.push('AUTHENTICATED');
  phase='PREIMAGE';
  before=await adapter.inspectPreimage({profile});
  need(Buffer.isBuffer(before?.host)&&
   (before?.registry===null||Buffer.isBuffer(before?.registry)),
   'B_PIN_PREIMAGE_UNAVAILABLE');
  equalSha(before.host,approval.hostBeforeSha256,'B_HOST_PREIMAGE_SHA');
  equalSha(before.registry,approval.registryBeforeSha256,'B_REGISTRY_PREIMAGE_SHA');
  phase='LOCK';
  lock=await adapter.acquireSharedWriterLock({requestId:pinnedApproval.requestId,profile});
  need(lock!==null&&lock!==undefined,'B_PIN_LOCK_FAILED');
  stages.push('SHARED_WRITER_LOCK');
  const again=await adapter.verifyPreimageUnderLock({lock,profile});
  need(Buffer.isBuffer(again?.host)&&
   (again?.registry===null||Buffer.isBuffer(again?.registry))&&
   again.host.equals(before.host)&&
   (before.registry===null?again.registry===null:
    Buffer.isBuffer(again.registry)&&again.registry.equals(before.registry)),
   'B_PIN_UNDER_LOCK_DRIFT');
  // FIRST_CREATE permits an absent leaf registry file, NEVER a missing drive,
  // missing pc-writer parent, redirected junction, or untrusted owner.
  // This is an inspection-only callback. No mkdir bootstrap is authorized.
  phase='REGISTRY_PARENT';
  const parent=await adapter.verifyApprovedRegistryParentUnderLock({lock,profile,
   targetId:'HOST_DATA_ROOT_PC_WRITER'});
  if(parent?.status==='DRIVE_UNAVAILABLE')fail('B_PIN_REGISTRY_DRIVE_UNAVAILABLE');
  if(parent?.status==='PARENT_ABSENT')fail('B_PIN_REGISTRY_PARENT_ABSENT');
  need(parent?.targetId==='HOST_DATA_ROOT_PC_WRITER'&&
   parent?.status==='EXISTS_TRUSTED_DIRECTORY'&&
   parent?.reparsePoint===false&&parent?.ownerVerified===true,
   'B_PIN_REGISTRY_PARENT_UNTRUSTED');
  stages.push('TRUSTED_REGISTRY_PARENT_EXISTS');
  phase='PLAN';
  const hostAfter=patchHostRuntimePinBytes(before.host,approval);
  equalSha(hostAfter,approval.hostAfterSha256,'B_HOST_TARGET_SHA');
  const registryAfter=await adapter.loadApprovedRegistryAfterBytes({
   lock,profile,approvalSha256:approval.registryAfterSha256,
  });
  need(Buffer.isBuffer(registryAfter),'B_REGISTRY_TARGET_BYTES');
  equalSha(registryAfter,approval.registryAfterSha256,'B_REGISTRY_TARGET_SHA');
  verifyRegistryEntryOnly(before.registry,registryAfter,{
   entryKey:approval.registryEntryKey,
   beforeEntrySha256:approval.registryEntryBeforeSha256,
   afterEntrySha256:approval.registryEntryAfterSha256,
   sourceSha:approval.sourceSha,
  });
  // Both files refer to the same newly approved runtime inventory.
  need(digest(registryAfter)===approval.newPin,'B_PIN_REGISTRY_BINDING');
  plan={hostAfter,registryAfter,
   hostBeforeSha256:approval.hostBeforeSha256,
   registryBeforeSha256:approval.registryBeforeSha256,
   hostAfterSha256:approval.hostAfterSha256,
   registryAfterSha256:approval.registryAfterSha256};
  stages.push('EXACT_TWO_FILE_PLAN');
  phase='BACKUP';
  backup=await adapter.backupBoth({lock,profile,requestId:pinnedApproval.requestId,
   beforeSha256:{host:plan.hostBeforeSha256,registry:plan.registryBeforeSha256}});
  need(backup?.complete===true&&typeof backup.journalId==='string',
   'B_PIN_BACKUP_UNKNOWN');
  stages.push('BOTH_BACKED_UP');
  phase='CAS_HOST';
  mutating=true;
  await adapter.casHost({lock,backup,expectedSha256:plan.hostBeforeSha256,
   afterBytes:plan.hostAfter});
  stages.push('HOST_CAS');
  phase='CAS_REGISTRY';
  await adapter.casRegistry({lock,backup,expectedSha256:plan.registryBeforeSha256,
   afterBytes:plan.registryAfter});
  stages.push('REGISTRY_CAS');
  phase='READBACK';
  const actual=await adapter.readBack({lock,profile});
  need(Buffer.isBuffer(actual?.host)&&Buffer.isBuffer(actual?.registry),
   'B_PIN_READBACK_UNAVAILABLE');
  equalSha(actual.host,plan.hostAfterSha256,'B_PIN_HOST_READBACK_DRIFT');
  equalSha(actual.registry,plan.registryAfterSha256,'B_PIN_REGISTRY_READBACK_DRIFT');
  stages.push('TWO_FILE_READBACK');
  phase='COMMIT';
  const committedResult=await adapter.commit({lock,backup});
  need(committedResult?.committed===true,'B_PIN_COMMIT_UNKNOWN');
  committed=true;status='PASS';code=null;phase='COMPLETE';
 }catch(error){
  code=errCode(error);
  if(phase==='COMMIT'||phase==='BACKUP'){
   status='STATE_UNKNOWN';retain=true;
   code=phase==='BACKUP'?'B_PIN_BACKUP_UNKNOWN':'B_PIN_COMMIT_UNKNOWN';
  }else if(mutating&&!committed&&lock!==null&&backup!==null){
   phase='ROLLBACK';
   try{
    // Reverse order of activation: registry first, then host.
    await adapter.restoreRegistry({lock,backup,
     beforeSha256:plan.registryBeforeSha256,afterSha256:plan.registryAfterSha256});
    await adapter.restoreHost({lock,backup,
     beforeSha256:plan.hostBeforeSha256,afterSha256:plan.hostAfterSha256});
    const restored=await adapter.verifyRestored({lock});
  need(Buffer.isBuffer(restored?.host)&&
     (restored?.registry===null||Buffer.isBuffer(restored?.registry))&&
     restored.host.equals(before.host)&&
     (before.registry===null?restored.registry===null:
      Buffer.isBuffer(restored.registry)&&restored.registry.equals(before.registry)),
     'B_PIN_ROLLBACK_UNVERIFIED');
    rollback='VERIFIED';stages.push('ROLLBACK_VERIFIED');
   }catch{
    status='STATE_UNKNOWN';code='B_PIN_ROLLBACK_UNVERIFIED';
    rollback='UNVERIFIED';retain=true;
   }
  }
 }finally{
  if(lock!==null&&!retain){
   try{await adapter.releaseSharedWriterLock({lock});}
   catch{status='STATE_UNKNOWN';code='B_PIN_RELEASE_UNKNOWN';retain=true;}
  }
 }
 // No raw host/registry bytes, no secret or entry values in public evidence.
 const report={requestId:pinnedApproval?.requestId??null,status,code,
  phase,sourceSha:approval?.sourceSha??null,
  profileId:approval?.profileId??null,
  beforeSha256:plan?{host:plan.hostBeforeSha256,registry:plan.registryBeforeSha256}:null,
  afterSha256:plan?{host:plan.hostAfterSha256,registry:plan.registryAfterSha256}:null,
  stages,rollback,retainLockForRecovery:retain};
  if(typeof adapter?.recordResult==='function'){
   try{
    const recorded=await adapter.recordResult({report});
    reportStatus=recorded?.json===true&&recorded?.txt===true?
     'JSON_TXT_2_OF_2':'INCOMPLETE';
   }catch{reportStatus='INCOMPLETE';}
  }
  return {...report,reportStatus,
   endToEndDone:status==='PASS'&&reportStatus==='JSON_TXT_2_OF_2',
   evidenceRecoveryRequired:status==='PASS'&&reportStatus!=='JSON_TXT_2_OF_2'};
}
