import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 PINNED_R181_SHA256,preparePinnedR181RouteCandidate,
 prepareR181RouteCandidateForExactPreimage,
} from '../tools/r181-pinned-route-candidate.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const original=Buffer.from([
 "const HOME='https://getmarkethistory.com';",
 "const fetchBar=async symbol=>fetch(HOME+'/api/v1/bars/stocks/'+symbol+'/1h');",
 "const ticker='SPY';",
].join('\n'));

test('fixture preparation is byte-deterministic, in-memory and JSON redacted',()=>{
 const before=Buffer.from(original),digest=sha(before);
 const result=prepareR181RouteCandidateForExactPreimage(before,digest);
 assert.equal(result.status,'PREPARED_CANDIDATE_ONLY');
 assert.equal(result.code,'R181_SINGLE_STATIC_ROUTE_CANDIDATE');
 assert.equal(result.observedPreimageSha256,digest);
 assert.equal(result.changedByteCount,3);
 assert.equal(result.applied,false);
 assert.equal(result.requiresIndependentBApproval,true);
 assert.equal(result.providerCalls,0);
 assert.equal(result.operationalWrites,0);
 const candidate=result.getPrivateCandidateBytes();
 assert.equal(sha(candidate),result.candidateSha256);
 assert.ok(candidate.toString('utf8').includes('/api/v1/bars/stocks/us/'));
 assert.ok(!candidate.toString('utf8').includes("'/api/v1/bars/stocks/'"));
 assert.deepEqual(before,original,'never mutate preimage');
 candidate.fill(0);
 assert.equal(sha(result.getPrivateCandidateBytes()),result.candidateSha256,
  'candidate getter returns independent copies');
 const publicJson=JSON.stringify(result);
 assert.equal(publicJson.includes('getPrivateCandidateBytes'),false);
 assert.equal(publicJson.includes('getmarkethistory.com'),false);
 assert.equal(publicJson.includes('SPY'),false);
});

test('real PC-only R181 pinned SHA rejects every unverified source before patch',()=>{
 assert.match(PINNED_R181_SHA256,/^[0-9a-f]{64}$/);
 const result=preparePinnedR181RouteCandidate(original);
 assert.equal(result.status,'STOP');
 assert.equal(result.code,'R181_PREIMAGE_SHA_MISMATCH');
 assert.equal(result.applied,false);
 assert.equal('getPrivateCandidateBytes' in result,false);
});

test('already modern route and duplicate old routes cannot be modified',()=>{
 const modern=Buffer.from(original.toString().replace(
  '/api/v1/bars/stocks/','/api/v1/bars/stocks/us/'));
 const duplicate=Buffer.concat([original,Buffer.from(
  "\nconst backup='/api/v1/bars/stocks/';")]);
 for(const [input,want] of [
  [modern,'R181_CURRENT_ROUTE_ALREADY_PRESENT'],
  [duplicate,'R181_LEGACY_ROUTE_NOT_UNIQUE'],
 ]){
  const result=prepareR181RouteCandidateForExactPreimage(input,sha(input));
  assert.equal(result.code,want);
  assert.equal(result.operationalWrites,0);
 }
});

test('comment-only route text cannot be patched as runnable code',()=>{
 const src=Buffer.from([
  "const HOME='https://getmarkethistory.com';",
  "const symbol='SPY';",
  "async function run(){return fetch(HOME);}",
  "// const old='/api/v1/bars/stocks/';",
 ].join('\n'));
 const result=prepareR181RouteCandidateForExactPreimage(src,sha(src));
 assert.equal(result.code,'R181_ROUTE_NOT_IN_STRING_LITERAL');
});

test('SHA drift, non-UTF8, oversize and unrelated source safely STOP',()=>{
 const cases=[
  [original,'a'.repeat(64),'R181_PREIMAGE_SHA_MISMATCH'],
  [Buffer.from([0xff,0xfe,0x42]),sha(Buffer.from([0xff,0xfe,0x42])),'R181_PREIMAGE_NOT_UTF8'],
  [Buffer.alloc(8193,0x61),sha(Buffer.alloc(8193,0x61)),'R181_PREIMAGE_UNSAFE_BYTES'],
  [Buffer.from("const x='/api/v1/bars/stocks/';"),sha(Buffer.from("const x='/api/v1/bars/stocks/';")),'R181_SOURCE_CONTEXT_UNVERIFIED'],
 ];
 for(const [input,expected,code] of cases){
  const result=prepareR181RouteCandidateForExactPreimage(input,expected);
  assert.equal(result.code,code);
  assert.equal(result.applied,false);
  assert.equal('getPrivateCandidateBytes' in result,false);
 }
});

test('template literal containing static old path is eligible, nonliteral is not',()=>{
 const template=Buffer.from([
  "const HOME='https://getmarkethistory.com';",
  "async function run(){return fetch(HOME+",
  "  "+String.fromCharCode(96)+"/api/v1/bars/stocks/"+
   "SPY/1h"+String.fromCharCode(96)+");}",
 ].join('\n'));
 const result=prepareR181RouteCandidateForExactPreimage(template,sha(template));
 assert.equal(result.status,'PREPARED_CANDIDATE_ONLY');
 assert.equal(result.applied,false);
});
