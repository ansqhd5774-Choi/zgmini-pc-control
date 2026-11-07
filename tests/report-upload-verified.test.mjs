import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {renderBoundedReport,projectSourcePreflightReport,uploadVerifiedReportPair} from '../controller/report-upload-verified.mjs';

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

test('GitHub lookup access failure cannot be treated as upload success',async()=>{
 const calls=[];const api=async(route,method='GET')=>{
  calls.push({route,method});return {status:403,data:{message:'forbidden'}};
 };
 await assert.rejects(uploadVerifiedReportPair({...params,api}),
  {code:'REPORT_FILE_READBACK_NOT_VERIFIED'});
 assert.equal(calls.length,3);
 assert.equal(calls.some(c=>c.method==='PUT'),false);
});

test('caller posts Issue comment only after await of both verified artifacts',()=>{
 const entry=fileURLToPath(new URL('../controller/upload.mjs',import.meta.url));
 const src=fs.readFileSync(entry,'utf8');
 assert.ok(src.indexOf('await uploadVerifiedReportPair(')>=0);
 assert.ok(src.indexOf('await uploadVerifiedReportPair(')<src.indexOf('const allComments='));
 assert.ok(src.indexOf('const allComments=')<src.indexOf('if(!comments.some('));
 assert.match(src,/resultFiles:files\.length/);
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

