import test from 'node:test';
import assert from 'node:assert/strict';
import {R54_B_V3_FIXED_SOURCE_TRANSITIONS,inspectR54Bv3SourceTransition}
 from '../tools/update.mjs';
import {r54Bv3DraftManifest}
 from '../../r54-manifest-v3-agent/tools/theme-nine-r54-b-guard-v3.mjs';

const pin=R54_B_V3_FIXED_SOURCE_TRANSITIONS;
const rows=field=>pin.map(x=>({path:x.path,sha256:x[field]}));

test('inline fixed 9-path pins agree with independent V3 draft, not old V2',()=>{
 const v3=r54Bv3DraftManifest();
 const originals=[...v3.sixFiles.map(x=>({path:x.path,sha256:x.original})),
  {path:v3.guardBootstrap.lease.path,sha256:null},
  ...v3.guardBootstrap.directSourceMutators.map(x=>({path:x.path,sha256:x.oldSha256}))];
 assert.equal(pin.length,9);
 assert.equal(new Set(pin.map(x=>x.path)).size,9);
 assert.deepEqual(new Map(rows('old').map(x=>[x.path,x.sha256])),
  new Map(originals.map(x=>[x.path,x.sha256])));
 assert.deepEqual(new Map(rows('next').map(x=>[x.path,x.sha256])),
  new Map([...v3.sixFiles.map(x=>({path:x.path,sha256:x.next})),
   {path:v3.guardBootstrap.lease.path,sha256:v3.guardBootstrap.lease.nextSha256},
   ...v3.guardBootstrap.directSourceMutators.map(x=>({path:x.path,sha256:x.nextSha256}))]
   .map(x=>[x.path,x.sha256])));
 assert.equal(pin.find(x=>x.interim)?.interim,v3.guardBootstrap.connector.guardedInterimSha256);
 assert.equal(v3.status,'DRAFT_NOT_INSTALLABLE');
});

test('exact baseline+candidate yields planning evidence only, never install readiness',()=>{
 const proof=inspectR54Bv3SourceTransition({originalRows:rows('old'),
  candidateRows:rows('next')});
 assert.equal(proof.status,'V3_SOURCE_PLAN_VALIDATED_NOT_INSTALLABLE');
 assert.equal(proof.fixedPaths,9);
 assert.equal(proof.taskDisableLimit,1);
 assert.equal(proof.taskRestoreLimit,1);
 assert.equal(proof.hasTrustedStartFreeze,false);
 assert.equal(proof.canInstall,false);
});

test('candidate drift and extra path must halt the 9-path transaction plan',()=>{
 const bad=rows('next');bad[3]={...bad[3],sha256:'0'.repeat(64)};
 assert.throws(()=>inspectR54Bv3SourceTransition({originalRows:rows('old'),
  candidateRows:bad}),/R54_B_V3_CANDIDATE_NINE_SHA_DRIFT/);
 assert.throws(()=>inspectR54Bv3SourceTransition({originalRows:rows('old'),
  candidateRows:[...rows('next'),{path:'unapproved.mjs',sha256:'0'.repeat(64)}]}),
  /R54_B_V3_CANDIDATE_NINE_SHA_DRIFT/);
});

test('mixed original source and any Task state alteration stop before mutation',()=>{
 const mixed=rows('old');mixed[0]={...mixed[0],sha256:pin[0].next};
 assert.throws(()=>inspectR54Bv3SourceTransition({originalRows:mixed,
  candidateRows:rows('next')}),/R54_B_V3_ORIGINAL_NINE_SHA_DRIFT/);
 assert.throws(()=>inspectR54Bv3SourceTransition({originalRows:rows('old'),
  candidateRows:rows('next'),taskPauseCount:1}),
  /R54_B_V3_NO_TASK_MUTATION_AT_PREFLIGHT/);
});
