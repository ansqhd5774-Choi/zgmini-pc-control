import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {uploadVerifiedReportPair} from '../controller/report-upload-verified.mjs';

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
