// Proposal-only contract for two independent, one-shot earnings D1 sidecars.
// Pure validation: no GitHub API, subprocess, provider request, PC/D1 write.
import {createHash} from 'node:crypto';

export const CONTROL_REPOSITORY='ansqhd5774-Choi/zgmini-pc-control';
export const SOURCE_REPOSITORY='ansqhd5774-Choi/zgmini';
export const ACTOR='ansqhd5774-Choi';
export const REQUEST_SCHEMA='ZGMINI_PC_PUBLICATION_REQUEST_V1';
export const APPROVAL_SCHEMA='ZGMINI_PC_PUBLICATION_APPROVAL_V1';
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const REQUEST_ID=new RegExp('^pc-publication-'+UUID+'$');
const CHAT_ID=new RegExp('^chat-'+UUID+'$');
const SHA40=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const OPS=Object.freeze({
  'bea-unit-profit-once':Object.freeze({
    script:'scripts/pc-writer/EARNINGS_BEA_UNIT_PROFIT_R1_ONCE.mjs',
    flags:Object.freeze(['--apply','--confirm-bea-unit-d1-write']),
    snapshotKey:'detail:earnings-bea-unit-profit:v1',
    approvalScope:'BEA_UNIT_PROFIT_SINGLE_KEY_D1_ONCE',
    provider:'FRED_CSV',
  }),
  'census-qfr-margin-once':Object.freeze({
    script:'scripts/pc-writer/EARNINGS_CENSUS_QFR_R4_D1_ONCE.mjs',
    flags:Object.freeze(['--apply','--confirm-census-qfr-d1-write']),
    snapshotKey:'detail:earnings-recession-indicators:census-qfr-mfg-margin:v1',
    approvalScope:'CENSUS_QFR_MARGIN_SINGLE_KEY_D1_ONCE',
    provider:'STORED_SQLITE_ONLY',
  }),
});

const exact=(object,keys,code)=>{
  if(!object||typeof object!=='object'||Array.isArray(object)
    ||Object.keys(object).length!==keys.length||keys.some(k=>!Object.hasOwn(object,k)))
    throw Error(code);
};
const required=(v,regex,code)=>{if(typeof v!=='string'||!regex.test(v))throw Error(code);};
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const operationSpec=name=>OPS[name]??null;

export function validatePublicationRequest(raw,{actor,repository,privateRepository,eventName,eventAction,labels}={}){
  if(actor!==ACTOR||repository!==CONTROL_REPOSITORY||privateRepository!==true
    ||eventName!=='issues'||eventAction!=='opened'
    ||!Array.isArray(labels)||!labels.includes('pc-publication'))
    throw Error('PUBLICATION_EVENT_NOT_AUTHORIZED');
  let request;
  try{request=JSON.parse(raw);}catch{throw Error('PUBLICATION_REQUEST_JSON_INVALID');}
  exact(request,['schema','requestId','chatId','operation','controlRepository',
    'approvalManifestSha256'],'PUBLICATION_REQUEST_FIELDS_INVALID');
  if(request.schema!==REQUEST_SCHEMA||request.controlRepository!==CONTROL_REPOSITORY)
    throw Error('PUBLICATION_REQUEST_CONTRACT_INVALID');
  required(request.requestId,REQUEST_ID,'PUBLICATION_REQUEST_ID_INVALID');
  required(request.chatId,CHAT_ID,'PUBLICATION_CHAT_ID_INVALID');
  required(request.approvalManifestSha256,SHA256,'PUBLICATION_MANIFEST_PIN_INVALID');
  if(!operationSpec(request.operation))throw Error('PUBLICATION_OPERATION_NOT_ALLOWED');
  return Object.freeze({...request});
}

export function validatePublicationApproval(request,bytes){
  if(!Buffer.isBuffer(bytes)&&typeof bytes!=='string')throw Error('PUBLICATION_MANIFEST_BYTES_REQUIRED');
  if(Buffer.byteLength(bytes)>8192)throw Error('PUBLICATION_MANIFEST_TOO_LARGE');
  if(sha256(bytes)!==request.approvalManifestSha256)throw Error('PUBLICATION_MANIFEST_HASH_MISMATCH');
  let approval;
  try{approval=JSON.parse(bytes.toString());}catch{throw Error('PUBLICATION_MANIFEST_JSON_INVALID');}
  exact(approval,['schema','requestId','operation','sourceRepository','publisherSha',
    'operationalSha','snapshotKey','approval','execution'],'PUBLICATION_MANIFEST_FIELDS_INVALID');
  const spec=operationSpec(request.operation);
  if(approval.schema!==APPROVAL_SCHEMA||approval.requestId!==request.requestId
    ||approval.operation!==request.operation||approval.sourceRepository!==SOURCE_REPOSITORY
    ||approval.snapshotKey!==spec.snapshotKey)throw Error('PUBLICATION_MANIFEST_SCOPE_MISMATCH');
  required(approval.publisherSha,SHA40,'PUBLICATION_PUBLISHER_SHA_INVALID');
  required(approval.operationalSha,SHA40,'PUBLICATION_OPERATIONAL_SHA_INVALID');
  exact(approval.approval,['grade','scope','actor','issueNumber'],'PUBLICATION_APPROVAL_FIELDS_INVALID');
  if(approval.approval.grade!=='B'||approval.approval.scope!==spec.approvalScope
    ||approval.approval.actor!==ACTOR||!Number.isSafeInteger(approval.approval.issueNumber)
    ||approval.approval.issueNumber<1)throw Error('PUBLICATION_B_APPROVAL_MISSING');
  exact(approval.execution,['mode','maxAutomaticRetries','maxD1Keys','provider'],
    'PUBLICATION_EXECUTION_FIELDS_INVALID');
  if(approval.execution.mode!=='ONCE'||approval.execution.maxAutomaticRetries!==0
    ||approval.execution.maxD1Keys!==1||approval.execution.provider!==spec.provider)
    throw Error('PUBLICATION_EXECUTION_SCOPE_INVALID');
  return Object.freeze({request,approval:Object.freeze(approval),
    invocation:Object.freeze({script:spec.script,flags:spec.flags,snapshotKey:spec.snapshotKey})});
}

export function validateBApprovalComment(validated,comments){
  const marker=`ZGMINI_B_PUBLICATION_APPROVED ${validated.request.requestId} ${validated.request.approvalManifestSha256}`;
  if(!Array.isArray(comments)||!comments.some(c=>c?.user?.login===ACTOR
    &&typeof c.body==='string'&&c.body.trim()===marker))
    throw Error('PUBLICATION_EXPLICIT_B_APPROVAL_NOT_FOUND');
  return true;
}

export function validateSourceCheckpoints(validated,{publisherHead,originMainHead,
  publisherBranch,operationalHead,configSource,publisherClean,operationalClean,
  publisherRoot,operationalRoot}={}){
  const approved=validated.approval;
  if(publisherHead!==approved.publisherSha||originMainHead!==approved.publisherSha
    ||publisherBranch!=='main'||publisherClean!==true)
    throw Error('PUBLICATION_PUBLISHER_NOT_CLEAN_MAIN');
  if(operationalHead!==approved.operationalSha||configSource!==approved.operationalSha
    ||operationalClean!==true||!publisherRoot||!operationalRoot
    ||publisherRoot.toLowerCase()===operationalRoot.toLowerCase())
    throw Error('PUBLICATION_OPERATIONAL_SOURCE_MISMATCH');
  return true;
}

export function classifyPublicationLedger(existing,validated){
  if(existing===null)return {status:'NEW',fingerprint:sha256(JSON.stringify(validated.request))};
  if(existing.requestId!==validated.request.requestId
    ||existing.fingerprint!==sha256(JSON.stringify(validated.request)))
    throw Error('PUBLICATION_DUPLICATE_PAYLOAD_CHANGED');
  return {status:'DUPLICATE_REUSED_NO_EXECUTION',phase:existing.phase};
}

export function validatePublicationReadback(validated,{status,key,d1Result,sourceVersion,sourceStoredAt}={}){
  if(status!=='PASS'||key!==validated.invocation.snapshotKey
    ||!['READBACK_VERIFIED','ALREADY_STORED'].includes(d1Result)
    ||!(typeof sourceVersion==='string'&&SHA256.test(sourceVersion))
    ||!Number.isSafeInteger(sourceStoredAt)||sourceStoredAt<=0)
    throw Error('PUBLICATION_D1_READBACK_NOT_VERIFIED');
  return true;
}
