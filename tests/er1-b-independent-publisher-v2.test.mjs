import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {
 ER1_SHA,ER1_PUBLIC_KEY,READER_HEADER,READER_URL,ER1_V2_SOURCE_HASHES,
 bindingFingerprint,validateV2Approval,validateV2ConfigBinding,
 inspectWranglerOAuth,verifyV2SourceFiles,publishIndependentER1Once,
} from '../er1-b-independent-publisher-v2.mjs';

const sha='a'.repeat(40);
const config={source:sha,collectionTarget:'pc',enabled:true,
 account:'b'.repeat(32),core:'123e4567-e89b-42d3-a456-426614174000',
 history:'123e4567-e89b-42d3-a456-426614174001'};
const manifest={schema:'ER1_PC_OPERATION_APPROVAL_V2',status:'APPROVED_B',
 approvedScope:'ER1_INDEPENDENT_SAVED_SCORE_AND_D1_ONE_SHOT',
 candidateSourceSha:ER1_SHA,pcConfigSourceSha:sha,
 pcBindingSha256:bindingFingerprint(config),readerHeader:READER_HEADER,
 probeUrl:READER_URL,publicKey:ER1_PUBLIC_KEY,runCount:1,
 allowCoreChanges:false,allowProviderRequests:false,
 allowSchemaChanges:false,allowCredentialRefresh:false,
 allowIndependentPublisherV2:true,sourceSha256:{...ER1_V2_SOURCE_HASHES,
  'tools/market-calendar-er1/ER1_B_INDEPENDENT_PUBLISHER_V2.mjs':
   'eed8247e26932c1f40398d16614e5a46230d9329d8f486bd507cd70d09f91862',
  'tools/market-calendar-er1/ER1_PC_OPERATION_V2_ONCE.mjs':
   '9f66cc60bbda7c31b3c94f995b609be3516b6c8ef2e2eb56e640f55e02c3213b'},
 pcHome:String.raw`E:\ZGmini\data\pc-writer`,dataRoot:String.raw`E:\ZGmini\data`,
 controlLedgerPath:'results/er1-b-global-once.json',allowControlLedgerWrite:true};
const derived={asOf:'2026-10-30',recordCount:838,star3Count:29};
const validator={ER1_EARNINGS_DISPLAY_PUBLIC_KEY:ER1_PUBLIC_KEY,
 validateER1PublicDisplay:x=>x?.asOf==='2026-10-30'
  ?{index:new Map(),asOf:x.asOf}:null};
const gate=async()=>true;
const pass=()=>true;
let dirs=[];
function fixture(){
 const dir=fs.mkdtempSync(path.join(tmpdir(),'er1-b-v2-'));
 dirs.push(dir);
 fs.mkdirSync(path.join(dir,'er1-input'),{recursive:true});
 fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify(config));
 fs.writeFileSync(path.join(dir,'er1-input','er1-public-display.json'),JSON.stringify(derived));
 return dir;
}
test.after(()=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true})});

test('not approved manifest is blocked',()=>{
 assert.throws(()=>validateV2Approval({...manifest,status:'PENDING_B'}),/ER1_B_V2_APPROVAL/);
});
test('source hash cannot be weakened in manifest',()=>{
 assert.throws(()=>validateV2Approval({...manifest,sourceSha256:{
  ...manifest.sourceSha256,'scripts/pc-writer/d1.mjs':'0'.repeat(64)}}),/ER1_B_V2_APPROVAL/);
});
test('config binding SHA and independently approved config.source both checked',()=>{
 assert.ok(validateV2ConfigBinding(config,manifest));
 assert.throws(()=>validateV2ConfigBinding({...config,account:'f'.repeat(32)},manifest),/CONFIG_BINDING/);
 assert.throws(()=>validateV2ConfigBinding({...config,source:'c'.repeat(40)},manifest),/CONFIG_BINDING/);
});
test('no pinned user login, expired and short-lived OAuth stop',()=>{
 const dir=fixture(),file=path.join(dir,'oauth.toml'),now=Date.now();
 assert.throws(()=>inspectWranglerOAuth({file,now}),/OAUTH_MISSING/);
 fs.writeFileSync(file,'oauth_token = "hidden-long-value"\nexpiration_time = "'+new Date(now+120000).toISOString()+'"\n');
 assert.throws(()=>inspectWranglerOAuth({file,now}),/REFRESH_REQUIRED/);
 fs.writeFileSync(file,'oauth_token = "hidden-long-value"\nexpiration_time = "'+new Date(now+1200000).toISOString()+'"\n');
 assert.equal(inspectWranglerOAuth({file,now}),true);
});
test('no pinned D1 file is fail closed',()=>{
 const dir=fixture();
 assert.throws(()=>verifyV2SourceFiles(dir,manifest),/PINNED_FILE_MISSING/);
});
test('global reservation is mandatory; Reader gate failure does not connect/write',async()=>{
 const dir=fixture();let remoteCalled=false;
 const args={sourceRoot:dir,pcHome:dir,manifest,
  sourceVerifier:pass,oauthInspector:pass,validatorFactory:async()=>validator,
  readerGate:async()=>false,remoteFactory:async()=>{remoteCalled=true;throw Error('NOT_WANTED')}};
 await assert.rejects(()=>publishIndependentER1Once(args),/GLOBAL_LEDGER_REQUIRED/);
 await assert.rejects(()=>publishIndependentER1Once({...args,globalLedgerReserved:true}),/READER_NOT_DEPLOYED/);
 assert.equal(remoteCalled,false);
});
test('identical public key avoids write',async()=>{
 const dir=fixture();let writes=0;
 const result=await publishIndependentER1Once({sourceRoot:dir,pcHome:dir,manifest,
  globalLedgerReserved:true,sourceVerifier:pass,oauthInspector:pass,
  validatorFactory:async()=>validator,readerGate:gate,
  remoteFactory:async()=>({query:async()=>({results:[{body:JSON.stringify(derived)}]}),
   request:async()=>{writes++}})});
 assert.equal(result.status,'ER1_ALREADY_PUBLISHED');assert.equal(writes,0);
});
test('single target D1 upsert followed by exact readback',async()=>{
 const dir=fixture();let written=null,writes=0,reads=0;
 const result=await publishIndependentER1Once({sourceRoot:dir,pcHome:dir,manifest,
  globalLedgerReserved:true,sourceVerifier:pass,oauthInspector:pass,
  validatorFactory:async()=>validator,readerGate:gate,
  remoteFactory:async()=>({query:async(db,sql,params)=>{
   reads++;assert.equal(db,config.core);assert.equal(params[0],ER1_PUBLIC_KEY);
   assert.match(sql,/kind='output'.*snapshot_key='current'/);
   return {results:written?[{body:written.body,stored_at:written.stored_at}]:[]};
  },request:async(db,batch)=>{
   writes++;assert.equal(db,config.core);assert.equal(batch.length,1);
   assert.match(batch[0].sql,/INSERT INTO public_feed_snapshots_v1/);
   assert.equal(batch[0].params[0],ER1_PUBLIC_KEY);
   written={body:batch[0].params[1],stored_at:batch[0].params[2]};
  }})});
 assert.equal(result.status,'ER1_D1_PUBLISHED_AND_READBACK');
 assert.equal(result.dbWrites,1);assert.equal(writes,1);assert.equal(reads,2);
});
test('ambiguous D1 write does not retry; returns UNKNOWN',async()=>{
 const dir=fixture();let attempts=0;
 await assert.rejects(()=>publishIndependentER1Once({sourceRoot:dir,pcHome:dir,manifest,
  globalLedgerReserved:true,sourceVerifier:pass,oauthInspector:pass,
  validatorFactory:async()=>validator,readerGate:gate,
  remoteFactory:async()=>({query:async()=>({results:[]}),
   request:async()=>{attempts++;throw Error('NETWORK_TIMEOUT')}})}),
  /ER1_B_V2_D1_OUTCOME_UNKNOWN_STOP/);
 assert.equal(attempts,1);
});
