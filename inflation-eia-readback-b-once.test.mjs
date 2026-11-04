import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {
  CONTROL_REPO,SOURCE_SHA,TITLE,REQUEST_SCHEMA,SCHEMA,
  savedReadback,resultName,validateRequest,upload,
} from './inflation-eia-readback-b-once.mjs';

const H=x=>createHash('sha256').update(x).digest('hex');
const UUID='12345678-1234-4234-8234-1234567890ab';
const req={schema:REQUEST_SCHEMA,operation:'verify-eia-saved-readonly-once',
  requestId:`pc-inflation-eia-readback-${UUID}`,chatId:`chat-${UUID}`,
  sourceSha:SOURCE_SHA};
const event=(body=JSON.stringify(req),number=777)=>({action:'opened',
  repository:{private:true,full_name:CONTROL_REPO},
  issue:{number,title:TITLE,user:{login:'ansqhd5774-Choi'},body}});
const env=()=>({GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ID:'run-987',
  GITHUB_TOKEN:'fixture-in-process-only'});
const store=(writer,overwrite=()=>{})=>{
  const directory=path.join(writer,'inflation-causal-r1');
  const rawdir=path.join(directory,'raw');
  fs.mkdirSync(rawdir,{recursive:true});
  const raw=[{period:'2026-01',stateid:'US',sectorid:'IND',price:'8.1',
    'price-units':'cents per kilowatt-hour'},
  {period:'2026-02',stateid:'US',sectorid:'IND',price:'8.3',
    'price-units':'cents per kilowatt-hour'}];
  const bytes=Buffer.from(JSON.stringify(raw));
  const digest=H(bytes);
  fs.writeFileSync(path.join(rawdir,`electricity-${digest}.json`),bytes);
  const data={schemaVersion:1,sourceVersion:'INFLATION_CAUSAL_GAS_ELECTRIC_R1',
    source:'EIA_INDUSTRIAL_ELECTRICITY_US',sourceStoredAt:'2026-11-04T01:23:45.678Z',
    frequency:'MONTHLY',unit:'CENTS_PER_KWH',facets:{stateid:'US',sectorid:'IND'},
    observations:[{month:'2026-01',value:8.1,unit:'cents_per_kWh'},
      {month:'2026-02',value:8.3,unit:'cents_per_kWh'}],
    rawArchive:{file:`raw/electricity-${digest}.json`,sha256:digest}};
  overwrite(data);
  fs.writeFileSync(path.join(directory,'electricity-industrial-eia.json'),JSON.stringify(data));
  return {directory,rawdir,digest};
};
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-eia-readback-'));
  const writer=path.join(root,'pc-writer');
  return {root,writer,dispose(){fs.rmSync(root,{recursive:true,force:true})}};
}

test('private issue exact shape and same UUID are required',()=>{
  const environment=env();
  assert.deepEqual(validateRequest(event(),environment),req);
  assert.throws(()=>validateRequest(event(JSON.stringify({...req,requestId:
    'pc-inflation-eia-readback-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})),environment),
  /EIAREADBACK_REQUEST_DENIED/);
  assert.throws(()=>validateRequest(event(JSON.stringify({...req,extra:1})),environment),
    /EIAREADBACK_REQUEST_DENIED/);
  assert.throws(()=>validateRequest({...event(),repository:{private:false,full_name:CONTROL_REPO}},environment),
    /EIAREADBACK_ISSUE_DENIED/);
  assert.throws(()=>validateRequest(event(),{...environment,GITHUB_ACTOR:'someone-else'}),
    /EIAREADBACK_ISSUE_DENIED/);
  assert.equal(resultName(777),'INFLATION_EIA_READBACK_RESULT_777.json');
  assert.notEqual(resultName(777),resultName(778));
  assert.throws(()=>resultName('../escaped'),/EIAREADBACK_ISSUE_NUMBER_DENIED/);
});

test('reads already stored EIA only; validates SHA and returns sanitized metadata',t=>{
  const f=fixture();t.after(()=>f.dispose());
  const {digest}=store(f.writer);
  const result=savedReadback(f.writer);
  assert.equal(result.count,2);
  assert.equal(result.latest,'2026-02');
  assert.equal(result.sourceStoredAt,'2026-11-04T01:23:45.678Z');
  assert.match(result.fileSha256,/^[a-f0-9]{64}$/);
  assert.equal(result.rawArchiveSha256,digest);
  assert.equal(Object.hasOwn(result,'observations'),false);
});

test('rejects wrong unit, facet, ordering and malformed timestamp',t=>{
  for(const mutate of [
    d=>{d.unit='USD_PER_KWH'},
    d=>{d.facets.stateid='CA'},
    d=>{d.observations[1].month='2026-01'},
    d=>{d.sourceStoredAt='yesterday'},
  ]){
    const f=fixture();t.after(()=>f.dispose());
    store(f.writer,mutate);
    assert.throws(()=>savedReadback(f.writer),/EIAREADBACK_(CONTRACT|MONTHLY_ROW)_DENIED/);
  }
});

test('rejects manipulated raw archive/hash and symlinked fixed file',t=>{
  const f=fixture();t.after(()=>f.dispose());
  const {directory,rawdir,digest}=store(f.writer);
  fs.appendFileSync(path.join(rawdir,`electricity-${digest}.json`),' ');
  assert.throws(()=>savedReadback(f.writer),/EIAREADBACK_ARCHIVE_HASH_DENIED/);
  const other=fixture();t.after(()=>other.dispose());
  const {directory:otherDir}=store(other.writer);
  const file=path.join(otherDir,'electricity-industrial-eia.json');
  const moved=path.join(otherDir,'moved.json');
  fs.renameSync(file,moved);
  fs.symlinkSync(moved,file);
  assert.throws(()=>savedReadback(other.writer),/EIAREADBACK_FILE_DENIED/);
});

test('upload accepts only same issue+request+run and no user raw data; mismatch refuses comments',async t=>{
  const f=fixture();t.after(()=>f.dispose());
  const file=path.join(f.root,resultName(777));
  const current={...env(),GITHUB_EVENT_PATH:path.join(f.root,'event.json'),
    GITHUB_WORKSPACE:f.root};
  fs.writeFileSync(current.GITHUB_EVENT_PATH,JSON.stringify(event()));
  const report={schema:SCHEMA,status:'PASS',code:'EIA_SAVED_PRIVATE_READBACK_VERIFIED',
    issueNumber:777,requestId:req.requestId,chatId:req.chatId,runId:current.GITHUB_RUN_ID,
    sourceSha:SOURCE_SHA,count:2,latest:'2026-02',
    sourceStoredAt:'2026-11-04T01:23:45.678Z',fileSha256:'a'.repeat(64),
    rawArchiveSha256:'b'.repeat(64),secretRawPayload:{secret:'never-post'}};
  fs.writeFileSync(file,JSON.stringify(report));
  const calls=[];
  await upload(current,async (url,options)=>{
    calls.push({url,options});return {ok:true};
  });
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/\/issues\/777\/comments$/);
  assert.doesNotMatch(calls[0].options.body,/never-post|secretRawPayload/);
  fs.writeFileSync(file,JSON.stringify({...report,requestId:'wrong'}));
  await assert.rejects(()=>upload(current,async()=>{throw Error('should not call')}),
    /EIAREADBACK_STALE_OR_UNTRUSTED_REPORT_DENIED/);
  fs.writeFileSync(file,JSON.stringify({...report,runId:'previous-run'}));
  await assert.rejects(()=>upload(current,async()=>{throw Error('should not call')}),
    /EIAREADBACK_STALE_OR_UNTRUSTED_REPORT_DENIED/);
});
