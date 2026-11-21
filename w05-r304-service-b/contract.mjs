// W05 service PPI one-shot B authorization. Pure/fail-closed; never a generic command runner.
import {createHash} from 'node:crypto';
export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const ISSUE_TITLE='pc-w05-r304-service-once';
export const MANIFEST='approvals/w05-r304-service-b/approval.json';
export const SOURCE_ROOT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const DATA_ROOT=String.raw`E:\ZGmini\data\pc-writer`;
export const OPERATION='w05-bls-service-append-once';
export const SCHEMA='ZGMINI_W05_R304_SERVICE_B_REQUEST_V1';
export const APPROVAL_SCHEMA='ZGMINI_W05_R304_SERVICE_B_APPROVAL_V1';
// Exact verified PC checkout/config/checkpoint from R3-04 A #2584 / Run 44870551163.
// Scope: three previously installed W05 files only; source pin is not effect approval.
export const INSTALLED_SHA='a206220cc11045c24660e814124edbba9c0ff49f';
export const FILES=Object.freeze({
 'scripts/pc-writer/EARNINGS_R3C_BLS_STORE_ONCE.mjs':'87e811b608ea7358c48aceebfe458e24e5887f2f31207481783abcad516a1af3',
 'scripts/pc-writer/EARNINGS_R3D_STORED_BLS_CALC_READONLY.mjs':'b441a52551a015ab9522280ee7c3f620fc8efd967c8dd0e6e04865bb72c97b31',
 'scripts/pc-writer/EARNINGS_R4_C_READ_MODEL_PREVIEW_READONLY.mjs':'f3f6e41b3b61039580db7ab7f6bed3133eb305ffef35e4b4b7ea919e0220ea77',
});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA64=/^[0-9a-f]{64}$/;
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const fail=code=>{throw Object.assign(new Error(code),{code});};
export const expect=(condition,code)=>{if(!condition)fail(code);};
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort());
export function validateIssue(event,env){
 expect(event?.action==='opened'&&event?.repository?.private===true&&
  event?.repository?.full_name===CONTROL_REPO&&event?.issue?.title===ISSUE_TITLE&&
  event?.issue?.user?.login==='ansqhd5774-Choi'&&
  event?.sender?.login==='ansqhd5774-Choi'&&
  event?.issue?.labels?.some(x=>x.name==='pc-writer-b-install')&&
  env?.GITHUB_REPOSITORY===CONTROL_REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR==='ansqhd5774-Choi'&&
  env.GITHUB_RUN_ATTEMPT==='1','W05_B_REQUEST_OR_ACTOR_DENIED');
 let body;try{body=JSON.parse(event.issue.body);}catch{fail('W05_B_REQUEST_JSON_STOP');}
 expect(exactKeys(body,['schema','requestId','chatId','operation','approvalPath','approvalSha256'])&&
   body.schema===SCHEMA&&body.operation===OPERATION&&body.approvalPath===MANIFEST&&
   typeof body.requestId==='string'&&body.requestId.startsWith('pc-w05-r304-')&&
   UUID.test(body.requestId.slice('pc-w05-r304-'.length))&&
   typeof body.chatId==='string'&&body.chatId.startsWith('chat-')&&
   UUID.test(body.chatId.slice(5))&&SHA64.test(body.approvalSha256),
   'W05_B_REQUEST_CONTRACT_STOP');
 return Object.freeze(body);
}
export function validateApproval(raw,request){
 expect(Buffer.isBuffer(raw)&&raw.length>50&&raw.length<12000&&
    sha256(raw)===request.approvalSha256,'W05_B_APPROVAL_BYTES_STOP');
 let doc;try{doc=JSON.parse(raw.toString('utf8'));}catch{fail('W05_B_APPROVAL_JSON_STOP');}
 expect(exactKeys(doc,['schema','status','scope','sourceRepository','installedSourceSha',
  'sourceRoot','dataRoot','files','series','startYear','endYear','maxProviderRequests',
  'runCount','allowSqliteAppend','allowD1Writes','allowTaskChanges','allowSchemaChanges',
  'allowOtherSources','allowNewSchedulers'])&&
  doc.schema===APPROVAL_SCHEMA&&doc.status==='APPROVED_B'&&
  doc.scope==='W05_WPSFD42_BLS_ONCE_EXISTING_SQLITE_APPEND'&&
  doc.sourceRepository==='ansqhd5774-Choi/zgmini'&&
  doc.installedSourceSha===INSTALLED_SHA&&doc.sourceRoot===SOURCE_ROOT&&
  doc.dataRoot===DATA_ROOT&&
  JSON.stringify(doc.files)===JSON.stringify(FILES)&&
  doc.series==='WPSFD42'&&doc.startYear===2025&&doc.endYear===2026&&
  doc.maxProviderRequests===1&&doc.runCount===1&&
  doc.allowSqliteAppend===true&&doc.allowD1Writes===false&&
  doc.allowTaskChanges===false&&doc.allowSchemaChanges===false&&
  doc.allowOtherSources===false&&doc.allowNewSchedulers===false,
  'W05_B_EFFECT_NOT_APPROVED');
 return Object.freeze(doc);
}
export function sanitizedCode(value){
 return typeof value==='string'&&/^W05_B_[A-Z0-9_]{2,85}$/.test(value)?
 value:'W05_B_UNEXPECTED_STOP';
}
