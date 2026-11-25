import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {renderBoundedReport,projectSourcePreflightReport,uploadVerifiedReportPair,resolveUploadPolicy,hasVerifiedReportComment,confirmVerifiedReportComment} from '../controller/report-upload-verified.mjs';
// The upload lease regression suite is run by the existing report CI step.
import './controller-exclusive-acquire.test.mjs';

const params={repository:'ansqhd5774-Choi/zgmini-pc-control',runId:'12345',attempt:'1',seat:'2',
 json:'{"ok":true}\n',txt:'status=PASS\r\n',wait:async()=>{}};
const target=extension=>`contents/results/12345-1-seat-2.${extension}`;
const encoded=contents=>({type:'file',encoding:'base64',content:Buffer.from(contents).toString('base64')});

function fixture({readback=true,timeoutPut=false,secondMissing=false}={}){
 const remote=new Map(),calls=[],texts={json:params.json,txt:params.txt};
 const api=async(route,method='GET',body)=>{
  calls.push({route,method});
  if(method==='PUT'){
   if(!(secondMissing&&route===target('txt')))remote.set(route,Buffer.from(body.content,'base64'));
   if(timeoutPut)throw Error('SIMULATED_PUT_TIMEOUT');
   return {status:201,data:{}};
  }
  if(!remote.has(route)||!readback)return {status:404,data:{}};
  return {status:200,data:encoded(remote.get(route))};
 };
 return {api,calls,remote,texts};
}

test('requires exact remote JSON and TXT readback after PUT before PASS',async()=>{
 const f=fixture();
 const links=await uploadVerifiedReportPair({...params,api:f.api});
 assert.equal(links.length,2);
 assert.deepEqual([...f.remote.keys()],[target('json'),target('txt')]);
 assert.equal(f.remote.get(target('json')).toString(),params.json);
 assert.equal(f.remote.get(target('txt')).toString(),params.txt);
 assert.equal(f.calls.filter(x=>x.method==='PUT').length,2);
 assert.equal(f.calls.filter(x=>x.method==='GET').length,4);
});

test('already uploaded identical bytes are reused without writing',async()=>{
 const f=fixture();f.remote.set(target('json'),Buffer.from(params.json));
 f.remote.set(target('txt'),Buffer.from(params.txt));
 const links=await uploadVerifiedReportPair({...params,api:f.api});
 assert.equal(links.length,2);
 assert.equal(f.calls.filter(x=>x.method==='PUT').length,0);
});

test('ambiguous PUT timeout is resolved by exact remote GET without duplicate PUT',async()=>{
 const f=fixture({timeoutPut:true});
 assert.equal((await uploadVerifiedReportPair({...params,api:f.api})).length,2);
 assert.equal(f.calls.filter(x=>x.method==='PUT').length,2);
});

test('persistent missing TXT after PUT exhausts bounded retries and never reports complete',async()=>{
 const f=fixture({secondMissing:true});
 await assert.rejects(uploadVerifiedReportPair({...params,api:f.api}),
  {code:'REPORT_FILE_READBACK_NOT_VERIFIED'});
 assert.equal(f.calls.filter(x=>x.method==='PUT'&&x.route===target('txt')).length,3);
 assert.equal(f.calls.filter(x=>x.method==='PUT'&&x.route===target('json')).length,1);
});

test('conflicting existing file fails closed without an overwrite',async()=>{
 const f=fixture();f.remote.set(target('json'),Buffer.from('other result'));
 await assert.rejects(uploadVerifiedReportPair({...params,api:f.api}),
  {code:'REPORT_REMOTE_CONTENT_CHANGED'});
 assert.equal(f.calls.filter(x=>x.method==='PUT').length,0);
});

test('malformed remote 200 response cannot pass or be replaced',async()=>{
 const calls=[];const api=async(route,method='GET')=>{
  calls.push({route,method});return {status:200,data:{type:'file'}};
 };
 await assert.rejects(uploadVerifiedReportPair({...params,api}),
  {code:'REPORT_REMOTE_INVALID'});
 assert.equal(calls.length,1);
});

test('GitHub line-wrapped canonical base64 is accepted for exact result files',async()=>{
 const f=fixture();
 const wrap=bytes=>bytes.toString('base64').replace(/(.{4})/g,'$1\r\n');
 const api=async(route,method='GET',body)=>{
  if(method==='PUT')throw Error('NO_WRITE_EXPECTED');
  const extension=route.endsWith('.json')?'json':'txt';
  return {status:200,data:{type:'file',encoding:'base64',content:wrap(Buffer.from(f.texts[extension]))}};
 };
 assert.equal((await uploadVerifiedReportPair({...params,api})).length,2);
});

test('malformed base64 that decodes to identical bytes cannot certify a remote report',async()=>{
 const canonical=Buffer.from(params.json).toString('base64');
 for(const malformed of [
  canonical+'#', // Node Buffer.from(base64) silently ignores this character
  '#'+canonical,
  canonical+'=',
  canonical.replace(/(.{4})/,'$1 '),
  canonical.replace(/(.{4})/,'$1_'),
 ]){
  const calls=[];
  const api=async(route,method='GET')=>{
   calls.push({route,method});
   return {status:200,data:{type:'file',encoding:'base64',content:malformed}};
  };
  await assert.rejects(uploadVerifiedReportPair({...params,api}),{code:'REPORT_REMOTE_INVALID'});
  assert.equal(calls.length,1);
  assert.equal(calls[0].method,'GET');
 }
});

test('noncanonical pad bits cannot certify the same decoded bytes',async()=>{
 const calls=[];
 // Node decodes AR== to the same 0x01 byte as canonical AQ==.
 assert.deepEqual(Buffer.from('AR==','base64'),Buffer.from('AQ==','base64'));
 const api=async(route,method='GET')=>{
  calls.push(method);return {status:200,data:{type:'file',encoding:'base64',content:'AR=='}};
 };
 await assert.rejects(uploadVerifiedReportPair({...params,json:'\x01',api}),
  {code:'REPORT_REMOTE_INVALID'});
 assert.deepEqual(calls,['GET']);
});

test('GitHub lookup access failure cannot be treated as upload success',async()=>{
 const calls=[];const api=async(route,method='GET')=>{
  calls.push({route,method});return {status:403,data:{message:'forbidden'}};
 };
 await assert.rejects(uploadVerifiedReportPair({...params,api}),
  {code:'REPORT_FILE_READBACK_NOT_VERIFIED'});
 assert.equal(calls.length,3);
 assert.equal(calls.some(c=>c.method==='PUT'),false);
});


test('bounded branch-tip conflict retries preserve the exact output and recover on later success',async()=>{
 const remote=new Map(),puts=[];
 const api=async(route,method='GET',body)=>{
  if(method==='PUT'){
   puts.push(route);
   if(puts.length<=2)return {status:409,data:{message:'conflict'}};
   remote.set(route,Buffer.from(body.content,'base64'));
   return {status:201,data:{}};
  }
  return remote.has(route)?{status:200,data:encoded(remote.get(route))}:{status:404,data:{}};
 };
 const links=await uploadVerifiedReportPair({...params,api});
 assert.equal(links.length,2);
 assert.equal(puts.length,4,'two conflicts plus successful JSON and TXT creations');
 assert.equal(remote.get(target('json')).toString(),params.json);
 assert.equal(remote.get(target('txt')).toString(),params.txt);
});

test('persistent 409 conflict remains a failure after five bounded attempts with HTTP evidence',async()=>{
 let puts=0;
 const api=async(_route,method='GET')=>{
  if(method==='PUT'){puts++;return {status:409,data:{message:'do not log this'}};}
  return {status:404,data:{}};
 };
 await assert.rejects(uploadVerifiedReportPair({...params,api}),error=>{
  assert.equal(error.code,'REPORT_FILE_READBACK_NOT_VERIFIED');
  assert.deepEqual(error.evidence,{extension:'json',initialGetStatus:404,putStatus:409,
   postPutGetStatus:404,putOutcomeUnknown:false,maxAttempts:5});
  assert.doesNotMatch(JSON.stringify(error.evidence),/do not log this/);
  return true;
 });
 assert.equal(puts,5);
});

test('GitHub denied PUT preserves safe 403 status and never reports a verified file',async()=>{
 let puts=0;
 const api=async(_route,method='GET')=>{
  if(method==='PUT'){puts++;return {status:403,data:{token:'DO_NOT_LOG'}};}
  return {status:404,data:{}};
 };
 await assert.rejects(uploadVerifiedReportPair({...params,api}),error=>{
  assert.equal(error.code,'REPORT_FILE_READBACK_NOT_VERIFIED');
  assert.equal(error.evidence.extension,'json');
  assert.equal(error.evidence.initialGetStatus,404);
  assert.equal(error.evidence.putStatus,403);
  assert.equal(error.evidence.postPutGetStatus,404);
  assert.equal(error.evidence.maxAttempts,3);
  assert.doesNotMatch(JSON.stringify(error.evidence),/DO_NOT_LOG/);
  return true;
 });
 assert.equal(puts,3);
});

test('caller posts Issue comment only after await of both verified artifacts',()=>{
 const entry=fileURLToPath(new URL('../controller/upload.mjs',import.meta.url));
 const src=fs.readFileSync(entry,'utf8');
 assert.ok(src.indexOf('await uploadVerifiedReportPair(')>=0);
 assert.ok(src.indexOf('await uploadVerifiedReportPair(')<src.indexOf('const allComments='));
 assert.ok(src.indexOf('const allComments=')<src.indexOf('if(!hasVerifiedReportComment('));
 assert.match(src,/resultFiles:files\.length/);
});

test('quoted report marker does not suppress the exact run receipt',()=>{
 const marker='<!-- zgmini-pc-result:12345:1:2 -->';
 const body=marker+'\n**PASS — CORE_READONLY_DIAGNOSIS**\n';
 const bot=userBody=>({user:{login:'github-actions[bot]'},body:userBody});
 const other={user:{login:'ansqhd5774-Choi'},body};
 assert.equal(hasVerifiedReportComment([
  bot('Previous diagnostic quoted: '+body),other],{marker,body}),false);
 assert.equal(hasVerifiedReportComment([bot(body)],{marker,body}),true);
 assert.equal(hasVerifiedReportComment([bot(body),bot('Quoted: '+body)],{marker,body}),true);
});

test('same report identity with changed bot receipt fails closed',()=>{
 const marker='<!-- zgmini-pc-result:12345:1:2 -->';
 const body=marker+'\n**PASS — CORE_READONLY_DIAGNOSIS**\n';
 const bot=body=>({user:{login:'github-actions[bot]'},body});
 for(const replaced of [
  marker+'\n**PASS — CORRUPTED**\n',
  marker+'\n**FAIL — CORE_READONLY_DIAGNOSIS**\n',
 ]){
  assert.throws(()=>hasVerifiedReportComment([bot(replaced)],{marker,body}),
   {code:'REPORT_COMMENT_CONTENT_CHANGED'});
  assert.throws(()=>hasVerifiedReportComment([bot(body),bot(replaced)],{marker,body}),
   {code:'REPORT_COMMENT_CONTENT_CHANGED'});
 }
 assert.equal(hasVerifiedReportComment([bot('noise '+marker+'\n**FAIL**')],{marker,body}),false);
});

test('uploader requires exact body receipt rather than embedded marker substring',()=>{
 const src=fs.readFileSync(fileURLToPath(new URL('../controller/upload.mjs',import.meta.url)),'utf8');
 assert.match(src,/if\(!hasVerifiedReportComment\(comments,\{marker,body\}\)\)/);
 assert.match(src,/need\(hasVerifiedReportComment\(comments,\{marker,body\}\),'REPORT_COMMENT_OUTCOME_UNKNOWN'\)/);
 assert.doesNotMatch(src,/body\?\.includes\(marker\)/);
});

test('reporter confirms GitHub bot comment after successful POST before upload success',async()=>{
 const marker='<!-- zgmini-pc-result:12345:1:2 -->';
 const body=marker+'\n**PASS — FIXED_READONLY**\n';
 const bot={user:{login:'github-actions[bot]'},body};
 let calls=0,waits=0;
 assert.equal(await confirmVerifiedReportComment({
  readComments:async()=>{calls++;return calls===3?[bot]:[];},
  marker,body,wait:async()=>{waits++},
 }),true);
 assert.equal(calls,3);
 assert.equal(waits,2);
});

test('missing or unreadable GitHub bot receipt fails closed without replaying POST',async()=>{
 const marker='<!-- zgmini-pc-result:12345:1:2 -->';
 const body=marker+'\n**PASS — FIXED_READONLY**\n';
 let reads=0,waits=0;
 await assert.rejects(confirmVerifiedReportComment({
  readComments:async()=>{reads++;if(reads===2)throw Error('REMOTE_GET_TIMEOUT');return [];},
  marker,body,wait:async()=>{waits++},
 }),{code:'REPORT_COMMENT_OUTCOME_UNKNOWN'});
 assert.equal(reads,4);
 assert.equal(waits,3);
});

test('conflicting published bot receipt stops immediately and does not wait',async()=>{
 const marker='<!-- zgmini-pc-result:12345:1:2 -->';
 const body=marker+'\n**PASS — FIXED_READONLY**\n';
 let reads=0,waits=0;
 await assert.rejects(confirmVerifiedReportComment({
  readComments:async()=>{reads++;return [{user:{login:'github-actions[bot]'},
   body:marker+'\n**FAIL — CHANGED**\n'}];},
  marker,body,wait:async()=>{waits++},
 }),{code:'REPORT_COMMENT_CONTENT_CHANGED'});
 assert.equal(reads,1);
 assert.equal(waits,0);
});

test('REPORT_UPLOADED success is logged only after exact bot comment readback',()=>{
 const src=fs.readFileSync(fileURLToPath(new URL('../controller/upload.mjs',import.meta.url)),'utf8');
 const proof=src.indexOf('await confirmVerifiedReportComment({readComments:allComments,marker,body})');
 const success=src.indexOf("status:'REPORT_UPLOADED'");
 const cleanup=src.indexOf('const cleanup=cleanupVerifiedJobTemps(');
 assert.ok(proof>src.indexOf('await uploadVerifiedReportPair('));
 assert.ok(proof>src.indexOf('if(!hasVerifiedReportComment('));
 assert.ok(proof<success);
 assert.ok(success<cleanup);
 assert.match(src,/commentVerified:true/);
});

test('reports already within the combined limit retain the existing pretty JSON and TXT',()=>{
 const report={schema:'ZGMINI_PC_RESULT_V1',status:'PASS',code:'READ_ONLY',result:{count:1},firstFail:null};
 const out=renderBoundedReport(report,32768);
 assert.equal(out.json,JSON.stringify(report,null,2)+'\n');
 assert.equal(out.txt,'schema=ZGMINI_PC_RESULT_V1\r\nstatus=PASS\r\ncode=READ_ONLY\r\nfirstFail=null\r\n');
});

test('combined size uses UTF-8 bytes for Korean strings and never drops fields',()=>{
 const report={status:'PASS',message:'읽기 전용 진단',result:{label:'자료 검증',notes:'값 누락 없음'}};
 const pretty=JSON.stringify(report,null,2)+'\n';
 const txt='status=PASS\r\nmessage=읽기 전용 진단\r\n';
 const prettyBytes=Buffer.byteLength(pretty)+Buffer.byteLength(txt);
 const compactBytes=Buffer.byteLength(JSON.stringify(report)+'\n')+Buffer.byteLength(txt);
 assert.ok(prettyBytes>compactBytes);
 assert.ok(Buffer.byteLength(pretty)+txt.length<prettyBytes);
 const out=renderBoundedReport(report,compactBytes);
 assert.equal(out.json,JSON.stringify(report)+'\n');
 assert.equal(out.txt,txt);
 assert.deepEqual(JSON.parse(out.json),report);
 assert.throws(()=>renderBoundedReport(report,compactBytes-1),{code:'REPORT_SIZE'});
});

test('oversized pretty report uses compact JSON preserving all uncertain evidence and uploads exact bytes',async()=>{
 const report={status:'PASS',code:'RELEASE_CALENDAR_SOURCE_INVENTORY_READONLY',lastPass:'OPERATION_PASS',
  firstFail:null,result:{candidateCount:62,inventoryTruncated:true,
   earningsApiRequestObservations:{status:'STATE_UNKNOWN',coverage:'PARTIAL',observedDayCount:14},
   candidates:Array.from({length:32},(_,i)=>({
    path:`projects/candidate-${i}`,head:'a'.repeat(40),
    moduleSha256:'b'.repeat(64),collectorSha256:'c'.repeat(64),runnerSha256:'d'.repeat(64),
    collectorCallsCalendar:true,collectorImportsCalendar:true,matchesConfiguredSource:i===7,
    earningsApiCollector:{verifiedReadable:i===7,sha256:'e'.repeat(64),bytes:5625},
    identification:{status:'UNVERIFIED',source:'LOCAL_INSPECTION_READONLY',owner:'RELEASE_CALENDAR',notes:'CANDIDATE_ONLY'},
    sourceKeys:['a','b','c','d','e','f','g'],sourceCount:7,sourceParseStatus:'PARSED',
   }))}};
 const pretty=JSON.stringify(report,null,2)+'\n';
 const out=renderBoundedReport(report,32768);
 assert.ok(Buffer.byteLength(pretty)+Buffer.byteLength(out.txt)>32768,
  `pretty=${Buffer.byteLength(pretty)} txt=${Buffer.byteLength(out.txt)} compact=${Buffer.byteLength(JSON.stringify(report)+'\n')}`);
 assert.ok(Buffer.byteLength(out.json)+Buffer.byteLength(out.txt)<=32768);
 assert.equal(out.json,JSON.stringify(report)+'\n');
 assert.deepEqual(JSON.parse(out.json),report);
 assert.equal(JSON.parse(out.json).result.candidates.length,32);
 assert.equal(JSON.parse(out.json).result.earningsApiRequestObservations.status,'STATE_UNKNOWN');
 const f=fixture();
 const links=await uploadVerifiedReportPair({...params,json:out.json,txt:out.txt,api:f.api});
 assert.equal(links.length,2);
 assert.equal(f.remote.get(target('json')).toString(),out.json);
 assert.equal(f.remote.get(target('txt')).toString(),out.txt);
 const uploads=f.calls.filter(x=>x.method==='PUT').length;
 await uploadVerifiedReportPair({...params,json:out.json,txt:out.txt,api:f.api});
 assert.equal(f.calls.filter(x=>x.method==='PUT').length,uploads);
 const collision=fixture();
 collision.remote.set(target('json'),Buffer.from(pretty));
 await assert.rejects(uploadVerifiedReportPair({...params,json:out.json,txt:out.txt,api:collision.api}),
  {code:'REPORT_REMOTE_CONTENT_CHANGED'});
 assert.equal(collision.calls.filter(x=>x.method==='PUT').length,0);
});

test('32 KiB exact byte boundary is allowed, one extra byte is rejected',()=>{
 const make=length=>({status:'PASS',result:{label:'검증',blob:'x'.repeat(length)}});
 const base=make(0),txt='status=PASS\r\n';
 const baseSize=Buffer.byteLength(JSON.stringify(base)+'\n')+Buffer.byteLength(txt);
 const exact=make(32768-baseSize);
 const out=renderBoundedReport(exact,32768);
 assert.equal(Buffer.byteLength(out.json)+Buffer.byteLength(out.txt),32768);
 assert.equal(out.json,JSON.stringify(exact)+'\n');
 assert.throws(()=>renderBoundedReport(make(32769-baseSize),32768),{code:'REPORT_SIZE'});
});

test('large TXT alone cannot bypass the total byte limit',()=>{
 assert.throws(()=>renderBoundedReport({status:'다'.repeat(11000),result:{}},32768),
  {code:'REPORT_SIZE'});
});

test('even compact output over the same limit fails before any upload',()=>{
 const report={status:'PASS',result:{sensitiveBlob:'x'.repeat(32768)}};
 assert.throws(()=>renderBoundedReport(report,32768),{code:'REPORT_SIZE'});
 assert.equal(report.result.sensitiveBlob.length,32768);
});

test('large pc-source-preflight inventory reports explicit summary within 32KiB',async()=>{
 const file=(dir,index)=>({path:`${dir}/f${index}.mjs`,sha256:'a'.repeat(64),trackedDirty:null});
 const writer=Array.from({length:139},(_,i)=>file('scripts/pc-writer',i));
 const modules=Array.from({length:141},(_,i)=>file(i%2?'lib':'worker',i));
 const report={schema:'ZGMINI_PC_RESULT_V1',operation:'pc-source-preflight',
  status:'PASS',code:'PC_SOURCE_READONLY_DIAGNOSIS',sourceBranch:'main',
  result:{status:'PASS',code:'PC_SOURCE_READONLY_DIAGNOSIS',result:{
   sourceResolved:false,runtimeSourceVerified:false,
   lastWriterEvidence:{status:'PASS',sourceHead:'b'.repeat(40)},
   historicalCheckoutCandidate:{gitVerified:true,head:'b'.repeat(40),
    writerSourceInventory:{status:'PASS',complete:true,files:writer,issues:[],totalBytes:300000},
    moduleSourceInventory:{status:'PASS',complete:true,files:modules,issues:[],totalBytes:772068}}
  }}};
 const before=JSON.stringify(report);
 assert.throws(()=>renderBoundedReport({...report,operation:'another'},32768),{code:'REPORT_SIZE'});
 const out=renderBoundedReport(report,32768),transmitted=JSON.parse(out.json);
 assert.ok(Buffer.byteLength(out.json)+Buffer.byteLength(out.txt)<=32768);
 assert.equal(JSON.stringify(report),before,'full PC report must remain untouched');
 assert.equal(transmitted.status,'PASS');
 assert.equal(transmitted.reportTransfer.status,'SUMMARY_ONLY');
 assert.equal(transmitted.reportTransfer.omittedFileEntries,280);
 assert.equal(transmitted.reportTransfer.fullInventoryTransferVerified,false);
 assert.equal(transmitted.reportTransfer.hashRepresentation,'COMPACT_JSON_UTF8');
 assert.equal(transmitted.reportTransfer.fullReportSha256,
  createHash('sha256').update(before).digest('hex'));
 const c=transmitted.result.result.historicalCheckoutCandidate;
 for(const [inventory,files] of [[c.writerSourceInventory,writer],[c.moduleSourceInventory,modules]]){
  assert.equal(inventory.complete,true);
  assert.equal(inventory.filesTransfer,'OMITTED_SUMMARY_ONLY');
  assert.equal(inventory.filesCount,files.length);
  assert.equal(Object.hasOwn(inventory,'files'),false);
  assert.equal(inventory.filesSha256,createHash('sha256').update(JSON.stringify(files)).digest('hex'));
  assert.equal(inventory.filesHashRepresentation,'COMPACT_JSON_UTF8');
 }
 assert.equal(projectSourcePreflightReport({...report,operation:'other'}),null);
 const f=fixture();
 assert.equal((await uploadVerifiedReportPair({...params,json:out.json,txt:out.txt,api:f.api})).length,2);
 assert.equal(f.remote.get(target('json')).toString(),out.json);
});

test('small pc-source-preflight result remains fully intact',()=>{
 const report={operation:'pc-source-preflight',status:'PASS',result:{
  moduleSourceInventory:{status:'PARTIAL',complete:false,files:[{path:'lib/x.mjs',sha256:null}],
   issues:[{code:'WRITER_MODULE_FILE_UNAVAILABLE'}]}}};
 const transmitted=JSON.parse(renderBoundedReport(report,32768).json);
 assert.deepEqual(transmitted,report);
 assert.equal(Object.hasOwn(transmitted,'reportTransfer'),false);
});

test('duplicate preflight prior is summarized without changing original execution evidence',()=>{
 const prior={status:'PASS',code:'PC_SOURCE_READONLY_DIAGNOSIS',
  result:{moduleSourceInventory:{files:Array.from({length:400},(_,i)=>({
   path:`lib/${i}.mjs`,sha256:'d'.repeat(64)}))}}};
 const report={operation:'pc-source-preflight',status:'PASS',code:prior.code,
  reused:true,reuseCode:'DUPLICATE_REUSED_NO_EXECUTION',prior};
 const out=renderBoundedReport(report,32768),summary=JSON.parse(out.json);
 assert.ok(Buffer.byteLength(out.json)+Buffer.byteLength(out.txt)<=32768);
 assert.equal(summary.reused,true);
 assert.equal(summary.prior.status,'PASS');
 assert.equal(summary.prior.transfer,'SUMMARY_ONLY_PRIOR');
 assert.equal(summary.reportTransfer.priorSummarized,true);
 assert.equal(summary.reportTransfer.omittedFileEntries,0);
 assert.equal(report.prior.result.moduleSourceInventory.files.length,400);
});

test('public Issue summary-only indicator is visible before the JSON payload',()=>{
 const src=fs.readFileSync(fileURLToPath(new URL('../controller/upload.mjs',import.meta.url)),'utf8');
 assert.match(src,/const scopeNotice=/);
 assert.match(src,/전송 범위: SUMMARY_ONLY/);
 assert.match(src,/\.status==='SUMMARY_ONLY'/);
});


test('invalid policy permits only original fixed BLOCKED policy-error receipt upload',()=>{
 const spec={runId:'12345',attempt:'1',seat:'2'};
 const pointer={issueNumber:2536,report:{schema:'ZGMINI_PC_RESULT_V1',
  jobId:'run-12345-1-seat-2',status:'BLOCKED',code:'CONTROLLER_POLICY_UNAVAILABLE',
  lastPass:'EVENT_RECEIVED',firstFail:'EVENT_OR_REQUEST_VALIDATION',
  operationalWrites:0,providerCalls:0,d1Writes:0}};
 const fixed={controlRepository:'ansqhd5774-Choi/zgmini-pc-control',maxReportBytes:32768};
 for(const broken of [null,'{not json','',Buffer.from('not-json'), 'null', '[]', '{}', '42',
  JSON.stringify({controlRepository:'incorrect/repo',maxReportBytes:32768}),
  JSON.stringify({controlRepository:'ansqhd5774-Choi/zgmini-pc-control'}),
  JSON.stringify({controlRepository:'ansqhd5774-Choi/zgmini-pc-control',maxReportBytes:0})]){
  assert.deepEqual(resolveUploadPolicy(broken,{pointer,...spec}),fixed);
 }
 const ordinary={controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  maxReportBytes:16384,additionalPolicyField:true};
 assert.deepEqual(resolveUploadPolicy(JSON.stringify(ordinary),{pointer,...spec}),ordinary);
 for(const mutate of [
  p=>p.issueNumber=null,
  p=>p.report.extra='not-an-approved-field',
  p=>p.report.firstFail='ENGINE_IMPORT',
  p=>p.report.status='PASS',
  p=>p.report.code='CONTROLLER_IMPORT_MISSING',
  p=>p.report.jobId='run-12345-1-seat-3',
  p=>p.report.operationalWrites=1,
  p=>p.report.providerCalls=1,
  p=>p.report.d1Writes=1
 ]){
  const changed=structuredClone(pointer);mutate(changed);
  assert.throws(()=>resolveUploadPolicy('{bad',{pointer:changed,...spec}),
   {code:'REPORT_POLICY_UNAVAILABLE'});
 }
 assert.throws(()=>resolveUploadPolicy('{bad',{pointer,...spec,runId:'123/4'}),
  {code:'REPORT_POLICY_UNAVAILABLE'});
});

test('#3650 selective B one-file approval binds installed SHA and tested upload bytes',async()=>{
 const {manifestFingerprint,validateControllerSelectivePin,
  validateControllerOnlyInstallDelta,validateUpdateRequest,
  MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY}=await import('../tools/maintenance-contract.mjs');
 const installed='60f37de24cbad4adc0b6ee9eee3c98a43160443d';
 const target='4851f1ff1d04c86151c67578ea7a221f40081897';
 const selected='codex/report-upload-3650-selective-60f-20261126';
 const sourceMain='f75ad5adc7a1c30b32d9a2160fc45d6a516fbaf1';
 const file='controller/report-upload-verified.mjs';
 const approvedUrl='https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3656';
 const raw=fs.readFileSync(new URL('../approvals/controller-updates/'+target+'.json',import.meta.url));
 const manifest=JSON.parse(raw);
 const pin=JSON.parse(fs.readFileSync(new URL('../approvals/controller-selective-targets/'+target+'.json',import.meta.url)));
 const source=fs.readFileSync(new URL('../'+file,import.meta.url));
 const hash=value=>createHash('sha256').update(value).digest('hex');
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.approval.ref,approvedUrl);
 assert.equal(manifest.approval.grade,'B');
 assert.equal(manifest.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.equal(manifest.selectiveSource.branch,selected);
 assert.equal(manifest.selectiveSource.mainSha,sourceMain);
 assert.deepEqual(manifest.selectiveSource.customPaths,[]);
 assert.equal(manifest.selectiveSource.schema,'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1');
 assert.deepEqual(manifest.allowFiles.map(x=>x.path),[file]);
 assert.equal(manifest.allowFiles[0].sha256,hash(source));
 assert.equal(manifest.allowFiles[0].sha256,'65639a1281c1a39bf35bed773c1814aa973c38cd88bdb45a87f0081730887585');
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.checks.status,'PASS');
 assert.equal(manifest.checks.targetSha,target);
 assert.equal(manifest.backup.strategy,'VERSIONED_SNAPSHOT');
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.backup.rollback.kind,'RESTORE_INSTALLED_SHA');
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.postSourceBranch,'main');
 assert.equal(manifest.postSourceSha,'b6049aac81b3442a58b08050ee138921f87a09e6');
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 assert.equal(validateControllerOnlyInstallDelta([file],manifest.allowFiles),true);
 assert.throws(()=>validateControllerOnlyInstallDelta([file,'controller/operations.mjs'],manifest.allowFiles),
  /ALLOWFILE_DIFF_MISMATCH/);
 const request={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-71b68f93-61e6-4b6e-8cf3-45f61fa50618',
  chatId:'chat-report-upload-3650-selective-b-20261126',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:hash(raw)};
 assert.equal(validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:installed}).manifest.targetSha,target);
 assert.throws(()=>validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:'a'.repeat(40)}),
  /UPDATE_INSTALLED_SOURCE_DRIFT/);
});
