import test from 'node:test';
import assert from 'node:assert/strict';
import {createGhCredentialProvider} from '../agent-handoff/watcher-gh-credential.mjs';
import {runWatch} from '../agent-handoff/intake-watch-5s.mjs';

const fake='github_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

test('credential adapter uses only gh auth token, passes no token through argv/env, and caches 60s',async()=>{
  let count=0,clock=100000;
  const provider=createGhCredentialProvider({clock:()=>clock,exec:async(bin,args,opts)=>{
    count++;
    assert.equal(bin,'gh');
    assert.deepEqual(args,['auth','token','--hostname','github.com']);
    assert.equal(opts.env.GITHUB_TOKEN,undefined);
    assert.equal(opts.env.GH_TOKEN,undefined);
    assert.equal(opts.timeout,3000);
    assert.equal(opts.windowsHide,true);
    return {stdout:fake+'\r\n'};
  }});
  assert.equal(await provider(),fake);
  assert.equal(await provider(),fake);
  assert.equal(count,1);
  clock+=60000;
  assert.equal(await provider(),fake);
  assert.equal(count,2);
});

test('credential retrieval does not reveal credential or command error',async()=>{
 const missing=createGhCredentialProvider({exec:async()=>{throw Error('secret-value-not-for-logs')}});
 await assert.rejects(missing(),err=>err.message==='HANDOFF_GH_CREDENTIAL_UNAVAILABLE');
 const bad=createGhCredentialProvider({exec:async()=>({stdout:'untrusted secret value'})});
 await assert.rejects(bad(),err=>err.message==='HANDOFF_GH_TOKEN_INVALID');
});

test('concurrent credential consumers share one refresh without exposing token',async()=>{
 let requests=0;
 const provider=createGhCredentialProvider({exec:async()=>{
   requests++;await Promise.resolve();return {stdout:fake};
 }});
 const tokens=await Promise.all([provider(),provider(),provider()]);
 assert.deepEqual(tokens,[fake,fake,fake]);assert.equal(requests,1);
});

test('watcher acquires new token from provider and does not require env GITHUB_TOKEN',async()=>{
 let polls=0,gets=0;
 const ctl=new AbortController();
 const tokens=['github_pat_FAKE000000000000000000001','github_pat_FAKE000000000000000000002'];
 const p=()=>tokens[polls++]||tokens[1];
 await runWatch({tokenProvider:p,signal:ctl.signal,
   fetchImpl:async(_url,opts)=>{
     gets++;assert.equal(opts.headers.Authorization,'Bearer '+tokens[gets-1]);
     return {status:304,headers:{get:()=>null},json:async()=>[]};
   },
   clock:()=>1000,
   sleep:async()=>{if(gets===2)ctl.abort();},
   onReport:()=>{}
 });
 assert.equal(gets,2);
});

test('missing credential source is rejected rather than silently unauthenticated',async()=>{
 await assert.rejects(runWatch({fetchImpl:async()=>{throw Error('SHOULD_NOT_CALL')}}),
  /HANDOFF_WATCH_AUTH_REQUIRED/);
});
