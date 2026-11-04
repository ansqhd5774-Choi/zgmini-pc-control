import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectThemeNineR54Evidence} from '../controller/theme-nine-r54-evidence-readonly.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const json=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const write=(root,relative,bytes)=>{
  const p=path.join(root,...relative.split('/'));fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,bytes);return p;
};
function manifest(folder,entries) {
  return {version:1,project:folder,rosterSha256:'f'.repeat(64),
    source:'https://getmarkethistory.com',licenseStatus:'PRIVATE_RESEARCH_ONLY_PUBLICATION_NOT_APPROVED',files:entries};
}
function rawPage(root,folder,symbol,contents){
  const body=Buffer.from(contents),digest=sha(body),relative=`raw/${symbol}_${digest}.jsonl`;
  write(root,`themes/${folder}/${relative}`,body);
  return {symbol,path:relative,sha256:digest,source:'https://getmarkethistory.com',
    priceMode:'RAW_UNADJUSTED_1H_NOT_OFFICIAL_CLOSE'};
}
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zg-r54-adapter-'));
  const baseline='legacy-nine-r23',delta='legacy-nine-r35-delta';
  const first=rawPage(root,baseline,'SPY','{"date":"2026-10-28","close":1}\n');
  const second=rawPage(root,baseline,'XLK','{"date":"2026-10-28","close":2}\n');
  const newer=rawPage(root,baseline,'XLK','{"date":"2026-10-30","close":3}\n');
  const deltaPage=rawPage(root,delta,'SPY','{"date":"2026-10-28","close":4}\n');
  const old=manifest(baseline,[first,second]),current=manifest(baseline,[first,second,newer]);
  write(root,`themes/${baseline}/raw-manifest.json`,json(current));
  const deltaManifest=manifest(delta,[deltaPage]);
  write(root,`themes/${delta}/raw-manifest.json`,json(deltaManifest));
  const candidate={observationDate:'2026-10-28',phase:'CONFIRMED',baselineManifestSha256:sha(json(old)),
    deltaManifestSha256:sha(json(deltaManifest)),secret:'SHOULD_NOT_ESCAPE'};
  const candidateBytes=json(candidate),candidateFile=`THEME_NINE_R48_PRIVATE_CANDIDATE_2026-10-28_${sha(candidateBytes).slice(0,16)}.json`;
  write(root,`themes/legacy-nine-r48-private-candidate/${candidateFile}`,candidateBytes);
  write(root,'pc-writer/theme-nine-r54/logs/THEME_NINE_R54_CYCLE_2345_6789.txt',
    Buffer.from('STOP_R54_PUBLIC_CONNECTION THEME_NINE_R54_SOURCE_MANIFEST_SHA_DRIFT TOKEN_SECRET_NOT_FOR_REPORT\n'));
  return {root,baseline,old,current,delta,candidateFile,first,second,newer};
}

test('old R47 manifest is cryptographically reconstructed from append-only current prefix',()=>{
  const f=fixture();const before=sha(fs.readFileSync(path.join(f.root,'themes',f.baseline,'raw-manifest.json')));
  const report=inspectThemeNineR54Evidence(f.root);
  assert.equal(report.status,'PASS');assert.equal(report.operationalWrites,0);
  assert.equal(report.providerCalls,0);assert.equal(report.d1Writes,0);
  assert.equal(report.r48.candidates.length,1);
  const c=report.r48.candidates[0];
  assert.equal(c.status,'INSPECTED');assert.equal(c.baseline.status,'VERIFIED_PREFIX');
  assert.equal(c.baseline.prefixFileCount,2);assert.equal(c.baseline.appendedAfterCandidate,1);
  assert.equal(c.baseline.rawStatus,'RAW_VERIFIED');assert.equal(c.delta.status,'VERIFIED_PREFIX');
  assert.equal(report.r54.logs[0].knownError,'THEME_NINE_R54_SOURCE_MANIFEST_SHA_DRIFT');
  assert.equal(sha(fs.readFileSync(path.join(f.root,'themes',f.baseline,'raw-manifest.json'))),before);
  assert.doesNotMatch(JSON.stringify(report),/SHOULD_NOT_ESCAPE|TOKEN_SECRET_NOT_FOR_REPORT|\"close\"/);
});

test('tampered retained raw page invalidates a matching historical manifest prefix',()=>{
  const f=fixture();write(f.root,`themes/${f.baseline}/${f.first.path}`,'tampered historical prices\n');
  const r=inspectThemeNineR54Evidence(f.root);
  assert.equal(r.r48.candidates[0].baseline.status,'PREFIX_RAW_INVALID');
  assert.equal(r.r48.candidates[0].baseline.rawStatus,'RAW_SHA_DRIFT');
});

test('missing exact historical manifest hash cannot be guessed or replaced by current hash',()=>{
  const f=fixture(),home=`themes/legacy-nine-r48-private-candidate`;
  const name=f.candidateFile,file=path.join(f.root,home,name),candidate=JSON.parse(fs.readFileSync(file));
  fs.unlinkSync(file);candidate.baselineManifestSha256='a'.repeat(64);
  const bytes=json(candidate),newName=`THEME_NINE_R48_PRIVATE_CANDIDATE_2026-10-28_${sha(bytes).slice(0,16)}.json`;
  write(f.root,home+'/'+newName,bytes);
  const r=inspectThemeNineR54Evidence(f.root);
  assert.equal(r.r48.candidates[0].baseline.status,'NO_EXACT_PREFIX_MATCH');
  assert.equal(r.r48.candidates[0].expectedBaselineSha256,'a'.repeat(64));
});

test('redirected raw path is never read outside the fixed PC root',()=>{
  const f=fixture(),raw=path.join(f.root,'themes',f.baseline,f.first.path);
  const outside=path.join(f.root,'SECRET_OUTSIDE');fs.writeFileSync(outside,'LEAKED_SECRET');
  fs.unlinkSync(raw);fs.symlinkSync(outside,raw);
  const r=inspectThemeNineR54Evidence(f.root);
  assert.equal(r.r48.candidates[0].baseline.status,'PREFIX_RAW_INVALID');
  assert.equal(r.r48.candidates[0].baseline.rawStatus,'RAW_UNSAFE_FILE');
  assert.doesNotMatch(JSON.stringify(r),/LEAKED_SECRET|SECRET_OUTSIDE/);
});
