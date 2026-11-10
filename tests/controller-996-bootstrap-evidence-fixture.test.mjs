import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {review996BootstrapFixture} from '../tools/controller-996-c-native-trusted-bootstrap.mjs';
import {format996ContinuationConsentBody} from '../tools/controller-996-native-continuation-consent-reader.mjs';
import {CONTINUATION_EFFECTS} from '../tools/controller-996-continuation-gate.mjs';

const repository='ansqhd5774-Choi/zgmini-pc-control';
const prefix='repos/'+repository;
const owner={login:'ansqhd5774-Choi',id:327938088};
const S1='a'.repeat(40), S2='b'.repeat(40);
const bootstrap='tools/controller-996-c-native-trusted-bootstrap.mjs';
const operator='tools/controller-996-c-native-owner-operator.mjs';
const lock='tools/controller-996-c-native-owner-source-lock.json';
const zip='artifacts/controller-996/zgmini-996-c-native-owner-package.zip';
const manifestPath='docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const encode=value=>Buffer.from(JSON.stringify(value)+'\n');
const read=relative=>fs.readFileSync(new URL('../'+relative,import.meta.url));
const listing=JSON.parse(read('artifacts/controller-996/ZGMINI_996_OWNER_REVIEW_SHA256.json'));

function fixture(){
  const sourcePaths=Object.keys(listing.files).filter(key=>key.startsWith('tools/controller-996-')&&
    (key.endsWith('.mjs')||key.endsWith('.json'))&&key!==lock);
  assert.equal(sourcePaths.length,16);
  const files=new Map(sourcePaths.map(relative=>[relative,read(relative)]));
  files.set(zip,read('artifacts/controller-996/ZGMINI_996_OWNER_REVIEW.zip'));
  files.set(lock,encode({schema:'ZGMINI_CONTROLLER_996_NATIVE_OWNER_SOURCE_LOCK_V1',
    files:Object.fromEntries(sourcePaths.map(relative=>[relative,sha(files.get(relative))]))}));
  const requestId='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
  const manifest={schema:'ZGMINI_CONTROLLER_996_CONTINUATION_C_APPROVAL_V1',grade:'C',approved:true,
    operation:'ARCHIVE_INTERRUPTED_C_CLAIM_AND_INSTALL_LEASE',issueNumber:996,originalRequestId:requestId,
    continuationRequestId:'70a4c347-25ea-4fc6-83d2-c0c670115249',operatorCommit:S1,
    bootstrapSha256:sha(files.get(bootstrap)),operatorSha256:sha(files.get(operator)),
    sourceLockSha256:sha(files.get(lock)),packageSha256:sha(files.get(zip)),
    launchPins:{outerSha256:'1'.repeat(64),launcherSha256:'2'.repeat(64),
      helperSha256:'3'.repeat(64),nodeSha256:'4'.repeat(64)},
    originalPins:Object.fromEntries(['oldC','installOwner','installRecovery','backlog','installed',
      'stage','maintainer','PREPARED','WORKFLOW_ENABLE_ATTEMPTED','BACKLOG_CLOSE_ATTEMPTED']
      .map(key=>[key,'1'.repeat(64)])),
    effects:[...CONTINUATION_EFFECTS],workflowPutCount:0,backlogWriteCount:0,originalRequestRetryCount:0,issuePostCount:0,
  };
  const manifestBytes=encode(manifest);
  files.set(manifestPath,manifestBytes);
  const issued='2026-11-11T00:00:00Z';
  const approved={id:123,user:owner,created_at:issued,updated_at:issued,
    body:format996ContinuationConsentBody(manifest,sha(manifestBytes),S2)};
  const issue={number:996,user:owner,state:'open',title:'pc-controller-update',comments:1,updated_at:issued,
    body:JSON.stringify({schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',requestId,
      chatId:'chat-e29f389d-36fb-41d8-bc27-8f58a3facad9',operation:'controller-update',
      controlRepository:repository,targetControllerSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
      approvalManifestSha256:'98c76160e08f25187cee2b5d6c5bfa843bb589edc7a9bdd45a6713f92824ed94'})};
  const routes=[];
  let scans=0;
  return {routes,manifest, run({revokeAtEnd=false,corruptLocal=false,wrongOwner=false}={}){
    return review996BootstrapFixture({manifestCommitSha:S2,
      readLocal:relative=>corruptLocal&&relative===operator?
        Buffer.concat([files.get(relative),Buffer.from(' ')]):files.get(relative),
      readGet:route=>{
        routes.push(route);
        if(route==='user')return owner;
        if(route===prefix)return {id:1442936296,full_name:repository,private:true,owner};
        if(route===prefix+'/issues/996')return issue;
        if(route===prefix+'/issues/996/comments?per_page=100&page=1'){
          scans++;
          if(revokeAtEnd&&scans===3)return [approved,{...approved,id:124,body:'ZGMINI_CONTROLLER_996_CONTINUATION_C_REVOKE_V1'}];
          return wrongOwner?[{...approved,user:{...owner,id:owner.id+1}}]:[approved];
        }
        const relative=route.match(/^repos\/[^/]+\/[^/]+\/contents\/(.+)\?ref=([a-f0-9]{40})$/);
        assert.ok(relative,route);
        const bytes=files.get(relative[1]);
        assert.ok(bytes,route);
        assert.equal(relative[2],sourcePaths.includes(relative[1])?S1:S2);
        return {path:relative[1],type:'file',encoding:'base64',size:bytes.length,content:bytes.toString('base64'),
          sha:createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')};
      },
    });
  }};
}

test('Bootstrap verifies exact Owner comment and all Git and local bytes without authorizing a fixture',()=>{
  const f=fixture(), result=f.run();
  assert.equal(result.status,'FIXTURE_GIT_AND_LOCAL_BYTES_MATCHED',result.code);
  assert.equal(result.fixtureOnly,true);
  assert.equal(result.executionAuthorized,false);
  assert.equal(result.operatorStarted,false);
  assert.equal(result.filesCheckedAtS1,16);
  assert.equal(result.filesCheckedAtS2,3);
  assert.deepEqual(result.launchPins,f.manifest.launchPins);
  assert.equal(f.routes.at(-2),prefix+'/issues/996/comments?per_page=100&page=1');
});

for(const [options,code] of [
  [{wrongOwner:true},'C_996_BOOTSTRAP_OWNER_CONSENT_MISSING'],
  [{corruptLocal:true},'C_996_BOOTSTRAP_S1_CLOSURE_DRIFT'],
  [{revokeAtEnd:true},'C_996_BOOTSTRAP_FINAL_CONSENT_DRIFT'],
]){
  test('Bootstrap blocks '+code,()=>{
    const result=fixture().run(options);
    assert.equal(result.status,'BOOTSTRAP_NO_GO');
    assert.equal(result.code,code);
    assert.equal(result.operatorStarted,false);
  });
}
