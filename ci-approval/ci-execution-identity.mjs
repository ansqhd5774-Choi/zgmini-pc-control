// Request-bound CI workload identity. Not business approval or execution authority.
// Verify a short-lived proof in memory; never persist or log the bearer token.
import {createHash,createPublicKey,verify} from 'node:crypto';
const issuer='https://token.actions.githubusercontent.com';
const repo='ansqhd5774-Choi/zgmini-pc-control';
const workflow=repo+'/.github/workflows/ci-approval-controller-b.yml@';
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const positive=x=>typeof x==='string'&&/^[1-9]\d*$/.test(x);
const deny=code=>{throw Error(code)};
function decode(s){
 if(!/^[A-Za-z0-9_-]+$/.test(s))deny('CI_IDENTITY_ENCODING_INVALID');
 const b=Buffer.from(s,'base64url');
 if(b.toString('base64url')!==s)deny('CI_IDENTITY_ENCODING_INVALID');
 return b;
}
export function controllerBAudience(requestBytes){
 if(!Buffer.isBuffer(requestBytes)||!requestBytes.length||requestBytes.length>32768)
  deny('CI_IDENTITY_REQUEST_BYTES_INVALID');
 return 'urn:zgmini:controller-b:'+createHash('sha256').update(requestBytes).digest('hex');
}
export async function readGitHubOIDCKeys(){
 const res=await fetch(issuer+'/.well-known/jwks',{redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!res.ok)deny('CI_IDENTITY_KEYS_UNAVAILABLE');
 return res.json();
}
// The pin comes from independently installed receiver policy, never a request,
// token or candidate PR. The pinned reusable workflow must run only trusted code.
export async function verifyControllerBIdentity({token,requestBytes,trustedWorkflowSha,now=Math.floor(Date.now()/1000),readKeys=readGitHubOIDCKeys}={}){
 if(!sha(trustedWorkflowSha))deny('CI_IDENTITY_POLICY_NOT_CONFIGURED');
 if(typeof token!=='string'||token.length>16000||!Number.isSafeInteger(now))
  deny('CI_IDENTITY_TOKEN_INVALID');
 const parts=token.split('.');
 if(parts.length!==3)deny('CI_IDENTITY_TOKEN_INVALID');
 let header,claims;
 try{header=JSON.parse(decode(parts[0]));claims=JSON.parse(decode(parts[1]));}
 catch{deny('CI_IDENTITY_TOKEN_INVALID');}
 if(header?.alg!=='RS256'||typeof header.kid!=='string'||!header.kid||header.crit!==undefined||
    header.jku!==undefined||header.jwk!==undefined||header.x5u!==undefined)
  deny('CI_IDENTITY_HEADER_DENIED');
 const keys=await readKeys();
 const matches=Array.isArray(keys?.keys)?keys.keys.filter(k=>k.kid===header.kid&&k.kty==='RSA'&&
  (k.alg===undefined||k.alg==='RS256')&&(k.use===undefined||k.use==='sig')):[];
 if(matches.length!==1)deny('CI_IDENTITY_KEY_DENIED');
 let valid=false;
 try{const key=createPublicKey({key:matches[0],format:'jwk'});
  valid=key.asymmetricKeyType==='rsa'&&key.asymmetricKeyDetails.modulusLength>=2048&&
   verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,decode(parts[2]));
 }catch{deny('CI_IDENTITY_SIGNATURE_DENIED');}
 if(!valid)deny('CI_IDENTITY_SIGNATURE_DENIED');
 if(claims?.iss!==issuer||claims.aud!==controllerBAudience(requestBytes)||
    claims.repository!==repo||claims.repository_id!=='1442936296'||claims.repository_owner_id!=='327938088'||
    claims.repository_visibility!=='private'||claims.ref!=='refs/heads/main'||
    !['workflow_run','push'].includes(claims.event_name)||
    claims.job_workflow_ref!==workflow+trustedWorkflowSha||claims.job_workflow_sha!==trustedWorkflowSha||
    !positive(claims.run_id)||!positive(claims.run_attempt)||typeof claims.jti!=='string'||!claims.jti)
  deny('CI_IDENTITY_SCOPE_DENIED');
 if(![claims.iat,claims.nbf,claims.exp].every(Number.isSafeInteger)||claims.iat>now+30||
    claims.nbf>now+30||claims.exp<=now||claims.exp<=claims.iat||claims.exp<=claims.nbf||
    claims.exp-claims.iat>600)
  deny('CI_IDENTITY_TIME_DENIED');
 return Object.freeze({state:'CI_WORKLOAD_IDENTITY_VERIFIED_ONLY',runId:claims.run_id,
  runAttempt:claims.run_attempt,workflowSha:trustedWorkflowSha,
  requestSha256:createHash('sha256').update(requestBytes).digest('hex'),
  canPublish:false,canExecute:false});
}
