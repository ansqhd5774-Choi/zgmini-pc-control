import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {readTrustedControllerReadyFromGitHub} from '../tools/maintenance-ready-source.mjs';

const RAW=Buffer.from(JSON.stringify({schema:'ZGMINI_CONTROLLER_READY_FEED_V1',items:[]}));
const sha=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const path='coordination/controller-admission-ready.json';
const content={type:'file',path,sha:sha(RAW),encoding:'base64',content:RAW.toString('base64'),size:RAW.length};
function fakeGet(changes={}){
 const paths=[];
 return {paths,get:async endpoint=>{
  paths.push(endpoint);
  if(endpoint.endsWith('?ref=main'))return {...content,...changes.contents};
  throw Error('unexpected extra GitHub GET');
 }};
}

test('reads fixed control main source and verifies immutable Git blob digest',async()=>{
 const api=fakeGet();
 const result=await readTrustedControllerReadyFromGitHub({githubGet:api.get});
 assert.equal(result.status,'EMPTY');
 assert.deepEqual(api.paths,[
  '/repos/ansqhd5774-Choi/zgmini-pc-control/contents/coordination/controller-admission-ready.json?ref=main']);
});

test('source metadata and locally verified Git blob SHA mismatch fail closed',async()=>{
 for(const changes of [
  {contents:{path:'untrusted.json'}},
  {contents:{sha:'a'.repeat(40)}},
  {contents:{size:999}},
 ]){
  const api=fakeGet(changes);
  const result=await readTrustedControllerReadyFromGitHub({githubGet:api.get});
  assert.equal(result.status,'STATE_UNKNOWN');
 }
});

test('GET uncertainty never implies READY',async()=>{
 const api=async()=>{throw Error('network');};
 const result=await readTrustedControllerReadyFromGitHub({githubGet:api});
 assert.deepEqual([result.status,result.code],['STATE_UNKNOWN','QUEUE_READY_MAIN_GET_UNCERTAIN']);
 assert.deepEqual(await readTrustedControllerReadyFromGitHub({}),
  {status:'STATE_UNKNOWN',code:'QUEUE_GITHUB_GET_ADAPTER_MISSING'});
});

test('nonempty READY still requires independently trusted B execution approval',async()=>{
 const item={schema:'ZGMINI_CONTROLLER_ADMISSION_ITEM_V1',queueId:'queue-12345678',
  resourceLane:'controller-install',status:'READY',request:{},dependencies:[],executionIntent:{
   action:'SUBMIT_APPROVED_B_ONCE',approvalRef:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1'}};
 const bytes=Buffer.from(JSON.stringify({schema:'ZGMINI_CONTROLLER_READY_FEED_V1',items:[item]}));
 const record={...content,sha:sha(bytes),content:bytes.toString('base64'),size:bytes.length};
 const result=await readTrustedControllerReadyFromGitHub({githubGet:async()=>record});
 assert.deepEqual([result.status,result.code],['WAITING_APPROVAL','QUEUE_B_EXECUTION_PROOF_ADAPTER_MISSING']);
});
