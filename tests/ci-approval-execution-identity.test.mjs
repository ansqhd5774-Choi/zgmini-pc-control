import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {controllerBAudience,verifyControllerBIdentity} from '../ci-approval/ci-execution-identity.mjs';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const key={...publicKey.export({format:'jwk'}),kid:'fixture-key',alg:'RS256',use:'sig'};
const repo='ansqhd5774-Choi/zgmini-pc-control',pin='a'.repeat(40),now=1700000000;
const requestBytes=Buffer.from('{"requestId":"fixture"}');
const claims=()=>({iss:'https://token.actions.githubusercontent.com',aud:controllerBAudience(requestBytes),
 repository:repo,repository_id:'1442936296',repository_owner_id:'327938088',repository_visibility:'private',
 ref:'refs/heads/main',event_name:'workflow_run',job_workflow_ref:repo+'/.github/workflows/ci-approval-controller-b.yml@'+pin,
 job_workflow_sha:pin,run_id:'123',run_attempt:'1',jti:'fixture',iat:now-10,nbf:now-10,exp:now+290});
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function token(c=claims(),h={alg:'RS256',kid:key.kid}){
 const b=enc(h)+'.'+enc(c);return b+'.'+sign('RSA-SHA256',Buffer.from(b),privateKey).toString('base64url');
}
const opts=(c=claims())=>({token:token(c),requestBytes,trustedWorkflowSha:pin,now,readKeys:async()=>({keys:[key]})});
test('signed CI identity binds exact request, but is not permission to execute',async()=>{
 const x=await verifyControllerBIdentity(opts());assert.equal(x.state,'CI_WORKLOAD_IDENTITY_VERIFIED_ONLY');
 assert.equal(x.runId,'123');assert.equal(x.canPublish,false);assert.equal(x.canExecute,false);
});
for(const [name,patch] of [
 ['foreign repo',{repository_id:'42'}],['foreign owner',{repository_owner_id:'42'}],
 ['PR branch',{ref:'refs/pull/1/merge'}],['PR event',{event_name:'pull_request'}],
 ['wrong job workflow',{job_workflow_sha:'b'.repeat(40)}],['wrong audience',{aud:'other'}],
 ['wrong reusable workflow',{job_workflow_ref:repo+'/.github/workflows/other.yml@'+pin}]
])test(name+' denied even with valid signature',async()=>{
 await assert.rejects(()=>verifyControllerBIdentity(opts({...claims(),...patch})),/SCOPE_DENIED/);
});
test('modified body is denied',async()=>{await assert.rejects(()=>verifyControllerBIdentity({...opts(),requestBytes:Buffer.from('{}')}),/SCOPE_DENIED/);});
test('expired proof is denied',async()=>{await assert.rejects(()=>verifyControllerBIdentity(opts({...claims(),iat:now-500,nbf:now-500,exp:now-1})),/TIME_DENIED/);});
test('receiver pin is mandatory',async()=>{await assert.rejects(()=>verifyControllerBIdentity({...opts(),trustedWorkflowSha:undefined}),/POLICY_NOT_CONFIGURED/);});
test('invalid signature is denied',async()=>{
 const a=opts(),parts=a.token.split('.');const b=Buffer.from(parts[2],'base64url');b[0]^=1;parts[2]=b.toString('base64url');
 await assert.rejects(()=>verifyControllerBIdentity({...a,token:parts.join('.')}),/SIGNATURE_DENIED/);
});
test('token supplied key URL is denied',async()=>{await assert.rejects(()=>verifyControllerBIdentity({...opts(),token:token(claims(),{alg:'RS256',kid:key.kid,jku:'https://example.invalid'})}),/HEADER_DENIED/);});
