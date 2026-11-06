import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize,probeHistorical,sanitizeProbeResult,uploadProbe,claimOnce,
  loadProbeModules,recheckInstalledSource} from './historical-probe.mjs';

const requestId='r17-sip-historical-'+'a'.repeat(32);
const sourceSha='cf43e65bbf72f56b70a52bc5a650a0cb5682b6bc';
const event={action:'opened',repository:{private:true,full_name:'ansqhd5774-Choi/zgmini-pc-control'},
  sender:{login:'ansqhd5774-Choi'},issue:{number:538,user:{login:'ansqhd5774-Choi'},
    title:'pc-r17-sip-historical-probe',labels:[{name:'pc-r17-writer-b-install'}],
    body:JSON.stringify({schema:'ZGMINI_R17_SIP_HISTORICAL_REQUEST_V1',requestId,
      targetDate:'2026-11-06',expectedInstalledSourceSha:sourceSha})}};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_RUN_ID:'42299900000',GITHUB_TOKEN:'fake-token-length-more-than-20'};
const members=Array.from({length:503},(_,i)=>`TEST${i}`);
const full={version:1,phase:'PROVISIONAL',source:'ALPACA_SIP_PREMARKET_15MIN_DELAYED_SPLIT',
  expectedCount:503,observedCount:2,missingCount:501,referenceObservedCount:503,
  freshWithin30m:2,counts:{rising:1,falling:1,unchanged:0},
  collectionStatus:'COMPLETE'};

function fixture(options={}){
  const urls=[];const calls=[];const universeDates=[];
  return {urls,calls,universeDates,
    dependencies:{now:Date.parse('2026-11-06T15:00:00Z'),base:'/fixture',
      storedUniverse:(base,date)=>{assert.equal(base,'/fixture');
        universeDates.push(date);
        assert.ok(['2026-11-05','2026-11-04'].includes(date));
        if(date==='2026-11-05'&&options.universeError)throw Error(options.universeError);
        if(date==='2026-11-04'&&options.previousUniverseError)
          throw Error(options.previousUniverseError);
        return date==='2026-11-04'&&options.previousMembers?
          options.previousMembers:members;},
      loadLocalProviders:()=>{if(options.providerError)throw Error(options.providerError);
        return {APCA_API_KEY_ID:'PRIVATE',APCA_API_SECRET_KEY:'SECRET'};},
      createQuotaFetch:({mode,originalFetch})=>{assert.equal(mode,'enforce');
        if(options.quotaError)throw Error(options.quotaError);
        if(options.quotaEmpty)return {};
        return {fetch:originalFetch};},
      fetchImpl:async(input)=>{urls.push(input);return {status:200,ok:true};},
      fetchIexWindow:async input=>{
        calls.push(input);assert.equal(input.feed,'sip');
        await input.fetchImpl('https://data.alpaca.markets/v2/stocks/bars');
        if(options.error&&input.timeframe==='15Min')throw Error(options.error);
        return {bars:Object.create(null),pageComplete:options.incomplete?false:true};
      },
      calculateUsSipPremarket:raw=>{
        assert.equal(raw.priorDate,'2026-11-05');
        assert.equal(raw.sessionStartUtc,'2026-11-06T09:00:00.000Z');
        assert.equal(raw.slotEndUtc,'2026-11-06T14:30:00.000Z');
        assert.equal(raw.members.length,503);
        return {...full,...(options.empty?{observedCount:0,missingCount:503,
          freshWithin30m:0,counts:{rising:0,falling:0,unchanged:0}}:{}),
          collectionStatus:raw.currentPageComplete&&raw.referencePageComplete?
            'COMPLETE':'INCOMPLETE_PAGINATION'};
      },
      validUsSipPremarket:record=>record.expectedCount===503}};
}

test('scoped one-shot Issue and event are accepted',()=>{
  assert.equal(authorize(event,env).requestId,requestId);
});
test('untrusted actor, duplicate run, wrong date and extra fields stop',()=>{
  assert.throws(()=>authorize(event,{...env,GITHUB_RUN_ATTEMPT:'2'}),/SIP_PROBE_EVENT_STOP/);
  assert.throws(()=>authorize({...event,sender:{login:'untrusted'}},env),/SIP_PROBE_ISSUE_SCOPE_STOP/);
  assert.throws(()=>authorize({...event,issue:{...event.issue,body:JSON.stringify({
    ...JSON.parse(event.issue.body),targetDate:'2026-11-09'})}},env),/SIP_PROBE_BODY_STOP/);
  assert.throws(()=>authorize({...event,issue:{...event.issue,body:JSON.stringify({
    ...JSON.parse(event.issue.body),execute:'arbitrary'})}},env),/SIP_PROBE_BODY_STOP/);
});
test('historical SIP queries allowed after delay, fixed 503 members and approved windows',async()=>{
  const f=fixture();const got=await probeHistorical(f.dependencies);
  assert.equal(got.status,'SIP_HISTORICAL_REAL_DATA_PASS');
  assert.equal(got.universeAsOfDate,'2026-11-05');
  assert.equal(got.universeSelection,'EXACT_REQUESTED');
  assert.deepEqual(f.universeDates,['2026-11-05']);
  assert.equal(got.observedCount,2);assert.equal(got.risingCount,1);
  assert.equal(got.fallingCount,1);assert.equal(got.missingCount,501);
  assert.equal(got.providerCalls,2);assert.equal(f.calls.length,2);
  assert.equal(f.calls[0].timeframe,'1Day');
  assert.equal(f.calls[0].start,'2026-11-05T00:00:00Z');
  assert.equal(f.calls[1].timeframe,'15Min');
  assert.equal(f.calls[1].end,'2026-11-06T14:30:00.000Z');
});
test('before historical 16-minute delay no providers are queried',async()=>{
  const f=fixture();f.dependencies.now=Date.parse('2026-11-06T14:45:59Z');
  await assert.rejects(()=>probeHistorical(f.dependencies),/SIP_PROBE_HISTORICAL_NOT_YET_DELAYED/);
  assert.equal(f.calls.length,0);
});
test('only missing 11/05 universe reuses saved 11/04 503 for a clearly labeled diagnostic',async()=>{
  const f=fixture({universeError:'US_PROVISIONAL_UNIVERSE_MISSING'});
  const got=await probeHistorical(f.dependencies);
  assert.deepEqual(f.universeDates,['2026-11-05','2026-11-04']);
  assert.equal(got.status,'SIP_HISTORICAL_FALLBACK_DIAGNOSTIC');
  assert.equal(got.code,'SIP_PROBE_PREVIOUS_UNIVERSE_DIAGNOSTIC');
  assert.equal(got.universeAsOfDate,'2026-11-04');
  assert.equal(got.universeSelection,'PREVIOUS_SAVED_DIAGNOSTIC');
  assert.equal(got.providerCalls,2);
  assert.equal(got.expectedCount,503);
  assert.equal(f.calls[0].start,'2026-11-05T00:00:00Z');
  assert.equal(f.calls[1].end,'2026-11-06T14:30:00.000Z');
  const safe=sanitizeProbeResult(got,requestId,env.GITHUB_RUN_ID);
  assert.equal(safe.status,'SIP_HISTORICAL_FALLBACK_DIAGNOSTIC');
  assert.equal(safe.universeAsOfDate,'2026-11-04');
  assert.equal(safe.universeSelection,'PREVIOUS_SAVED_DIAGNOSTIC');
});
test('missing both fixed saved universes fails closed before providers',async()=>{
  const f=fixture({universeError:'US_PROVISIONAL_UNIVERSE_MISSING',
    previousUniverseError:'US_PROVISIONAL_UNIVERSE_MISSING'});
  await assert.rejects(()=>probeHistorical(f.dependencies),{
    safeCode:'US_PROVISIONAL_UNIVERSE_MISSING'});
  assert.deepEqual(f.universeDates,['2026-11-05','2026-11-04']);
  assert.equal(f.calls.length,0);
});
test('previous universe read error redacts sensitive path and never queries provider',async()=>{
  const f=fixture({universeError:'US_PROVISIONAL_UNIVERSE_MISSING',
    previousUniverseError:'E:\\sensitive\\db.sqlite'});
  await assert.rejects(()=>probeHistorical(f.dependencies),{
    safeCode:'SIP_PROBE_PREVIOUS_UNIVERSE_READ_STOP'});
  assert.equal(f.calls.length,0);
});
test('previous saved universe must be the verified 503, not a partial substitute',async()=>{
  const f=fixture({universeError:'US_PROVISIONAL_UNIVERSE_MISSING',
    previousMembers:members.slice(0,502)});
  await assert.rejects(()=>probeHistorical(f.dependencies),{
    safeCode:'SIP_PROBE_PREVIOUS_UNIVERSE_COUNT_STOP'});
  assert.equal(f.calls.length,0);
});
test('DB missing and universe invalid retain only safe codes, unknown error is redacted',async()=>{
  for(const code of ['US_PROVISIONAL_DB_MISSING','US_PROVISIONAL_UNIVERSE_INVALID']){
    const f=fixture({universeError:code});
    await assert.rejects(()=>probeHistorical(f.dependencies),{safeCode:code});
    assert.equal(f.calls.length,0);
    assert.deepEqual(f.universeDates,['2026-11-05']);
  }
  const f=fixture({universeError:'sensitive SQL path E:\\ZGmini\\...'});
  let error;try{await probeHistorical(f.dependencies);}catch(e){error=e;}
  assert.equal(error.safeCode,'SIP_PROBE_UNIVERSE_READ_STOP');
  assert.ok(!String(error).includes('E:\\ZGmini'));
});
test('provider env loader failure is categorized without exposing provider key',async()=>{
  const f=fixture({providerError:'API SECRET HEADER!'});
  await assert.rejects(()=>probeHistorical(f.dependencies),{
    safeCode:'SIP_PROBE_PROVIDER_ENV_STOP'});
  assert.equal(f.calls.length,0);
});
test('quota initialization failure is categorized before network calls',async()=>{
  const f=fixture({quotaError:'quota ledger path contents...'});
  await assert.rejects(()=>probeHistorical(f.dependencies),{
    safeCode:'SIP_PROBE_QUOTA_INIT_STOP'});
  assert.equal(f.calls.length,0);
  const empty=fixture({quotaEmpty:true});
  await assert.rejects(()=>probeHistorical(empty.dependencies),{
    safeCode:'SIP_PROBE_QUOTA_INIT_STOP'});
  assert.equal(empty.calls.length,0);
});
test('installed import failure uses a fixed stage code without dynamic path/stack',async()=>{
  let error;try{await loadProbeModules(async()=>{throw Error('file:///private/path');});}
  catch(e){error=e;}
  assert.equal(error.safeCode,'SIP_PROBE_MODULE_IMPORT_STOP');
  assert.ok(!String(error).includes('/private/path'));
});
test('second installed-source preflight exception is bounded without leaking paths',()=>{
  assert.throws(()=>recheckInstalledSource(()=>{throw Error('E:\\private\\file');}),{
    safeCode:'SIP_PROBE_SOURCE_RECHECK_STOP'});
  assert.equal(recheckInstalledSource(()=>true),true);
});
test('HTTP 403 yields a bounded error without secrets/raw prices',async()=>{
  const f=fixture({error:'US_PROVISIONAL_HTTP_403'});
  const got=await probeHistorical(f.dependencies);
  assert.equal(got.status,'SIP_HISTORICAL_NOT_VERIFIED');
  assert.equal(got.code,'US_PROVISIONAL_HTTP_403');
  assert.ok(!JSON.stringify(got).includes('SECRET'));
  assert.equal(got.providerCalls,2);
});
test('incomplete pagination is separate from successful full readback',async()=>{
  const f=fixture({incomplete:true});const got=await probeHistorical(f.dependencies);
  assert.equal(got.status,'SIP_HISTORICAL_INCOMPLETE_PAGINATION');
  assert.equal(got.collectionStatus,'INCOMPLETE_PAGINATION');
});
test('complete pagination with zero observed is not real data PASS and counts survive sanitization',async()=>{
  const f=fixture({empty:true});const raw=await probeHistorical(f.dependencies);
  assert.equal(raw.status,'SIP_HISTORICAL_EMPTY_OBSERVATION');
  assert.equal(raw.code,'SIP_PROBE_NO_OBSERVATIONS');
  assert.equal(raw.observedCount,0);
  const sanitized=sanitizeProbeResult(raw,requestId,'42299900000');
  assert.equal(sanitized.status,'SIP_HISTORICAL_EMPTY_OBSERVATION');
  assert.equal(sanitized.expectedCount,503);
  assert.equal(sanitized.missingCount,503);
  assert.equal(sanitized.risingCount,0);
  assert.equal(sanitized.fallingCount,0);
  assert.equal(sanitized.unchangedCount,0);
  assert.equal(sanitized.code,'SIP_PROBE_NO_OBSERVATIONS');
  assert.equal(sanitizeProbeResult({...raw,status:'SIP_HISTORICAL_REAL_DATA_PASS',
    code:'SIP_PROBE_VERIFIED'},requestId,'42299900000').code,
    'SIP_PROBE_RESULT_UNVERIFIED');
});
test('report sanitizer strips unapproved raw bars and tokens',()=>{
  const f=fixture();return probeHistorical(f.dependencies).then(result=>{
    const clean=sanitizeProbeResult({...result,token:'SECRET',bars:{TEST0:{c:300}}},requestId,'42299900000');
    assert.equal(clean.status,'SIP_HISTORICAL_REAL_DATA_PASS');
    assert.ok(!JSON.stringify(clean).includes('SECRET'));
    assert.ok(!JSON.stringify(clean).includes('TEST0'));
    assert.equal(clean.expectedCount,503);
  });
});
test('fallback date cannot be mislabeled as an exact full current PASS',async()=>{
  const f=fixture({universeError:'US_PROVISIONAL_UNIVERSE_MISSING'});
  const raw=await probeHistorical(f.dependencies);
  for(const forged of [
    {...raw,status:'SIP_HISTORICAL_REAL_DATA_PASS',code:'SIP_PROBE_VERIFIED'},
    {...raw,universeAsOfDate:'2026-11-05'},
    {...raw,universeSelection:'EXACT_REQUESTED'},
    {...raw,universeAsOfDate:'2026-11-03'},
  ])assert.equal(sanitizeProbeResult(forged,requestId,env.GITHUB_RUN_ID).code,
    'SIP_PROBE_RESULT_UNVERIFIED');
});
test('invalid count arithmetic fails closed',()=>{
  const record={status:'SIP_HISTORICAL_REAL_DATA_PASS',code:'SIP_PROBE_VERIFIED',
    observationDate:'2026-11-06',slotEndUtc:'2026-11-06T14:30:00.000Z',
    checkedAt:'2026-11-07T00:00:00.000Z',providerCalls:3,
    source:'ALPACA_SIP_PREMARKET_15MIN_DELAYED_SPLIT',
    collectionStatus:'COMPLETE',...Object.fromEntries([
      'expectedCount','observedCount','missingCount','risingCount','fallingCount',
      'unchangedCount','referenceObservedCount','freshWithin30m'].map(k=>[k,1]))};
  assert.equal(sanitizeProbeResult(record,requestId,'1').code,'SIP_PROBE_RESULT_UNVERIFIED');
});
test('durable private GitHub claim is required before provider calls and rejects duplicate requestId',async()=>{
  const files=new Map();let puts=0,gets=0;
  const api=async (url,init)=>{
    if(init.method==='PUT'){
      puts++;
      if(files.has(url))return {status:422};
      const body=JSON.parse(init.body);
      assert.ok(!Object.hasOwn(body,'sha')); // Create-only, no overwrite.
      files.set(url,Buffer.from(body.content,'base64'));
      return {status:201};
    }
    gets++;const bytes=files.get(url.replace('?ref=main',''));
    return {status:bytes?200:404,json:async()=>({encoding:'base64',
      content:bytes?.toString('base64')})};
  };
  const claim=await claimOnce({event,env,api});
  assert.equal(claim.claimed,true);assert.equal(puts,1);assert.equal(gets,2);
  await assert.rejects(()=>claimOnce({event,env,api}),/SIP_PROBE_DUPLICATE_REQUEST_STOP/);
  assert.equal(puts,1);
});
test('claim fails closed on GitHub read failure, ambiguous PUT, and unavailable token',async()=>{
  await assert.rejects(()=>claimOnce({event,env,api:async()=>({status:503})}),
    /SIP_PROBE_CLAIM_READ_STOP/);
  let calls=0;
  await assert.rejects(()=>claimOnce({event,env,api:async(url,init)=>{
    calls++;
    if(init.method==='PUT')throw Error('TIMEOUT');
    return {status:404};
  }}),/SIP_PROBE_CLAIM_WRITE_STOP/);
  assert.equal(calls,2);
  await assert.rejects(()=>claimOnce({event,env:{...env,GITHUB_TOKEN:undefined}}),
    /SIP_PROBE_CLAIM_TOKEN_STOP/);
});
test('result write is create-only and verified by readback, uploader never calls providers',async()=>{
  const f=fixture();const result=await probeHistorical(f.dependencies);
  const files=new Map();const methods=[];
  const api=async (url,init)=>{
    if(url.endsWith('/comments')){
      methods.push('COMMENT');return {status:201};
    }
    if(init.method==='PUT'){
      methods.push('PUT');files.set(url,Buffer.from(JSON.parse(init.body).content,'base64'));
      assert.ok(!JSON.parse(init.body).sha);
      return {status:201};
    }
    methods.push('GET');const bytes=files.get(url.replace('?ref=main',''));
    return {status:bytes?200:404,json:async()=>({encoding:'base64',content:bytes?.toString('base64')})};
  };
  const out=await uploadProbe({event,env,raw:result,api});
  assert.deepEqual(out,{status:'SIP_HISTORICAL_REAL_DATA_PASS',code:'SIP_PROBE_VERIFIED',
    created:2,verified:2});
  assert.deepEqual(methods,['PUT','GET','PUT','GET','COMMENT']);
  assert.ok(![...files.values()].some(b=>b.toString('utf8').includes('SECRET')));
});
