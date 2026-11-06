import test from 'node:test';
import assert from 'node:assert/strict';
import {
 validateRequest,validateApproval,validateEffects,resultFileName,
 PINNED_SOURCE_SHA
} from './er1-nov30-full-entry.mjs';

const SOURCE='a'.repeat(40),HASH='b'.repeat(64);
const rid='pc-nov30-full-12345678-1234-4123-a456-123456789abc';
const chat='chat-12345678-1234-4123-a456-123456789abc';
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened'};
const body=(operation='private-collect')=>({
 schema:'ZGMINI_ER1_NOV30_FULL_B_V1',operation,sourceSha:SOURCE,
 requestId:rid,chatId:chat,from:'2026-11-01',through:'2026-11-30'
});
const event=(req=body())=>({action:'opened',issue:{user:{login:'ansqhd5774-Choi'},
 title:'pc-er1-nov30-full',labels:[{name:'pc-er1-approved'}],
 body:JSON.stringify(req),number:123}});
const files=[
 'scripts/pc-writer/market-calendar-nov30-er1-probe-publish.mjs',
 'scripts/pc-writer/market-calendar-nov30-er1-full-private.mjs',
 'scripts/pc-writer/market-calendar-nov30-er1-score-publish.mjs'
].map(path=>({path,sha256:HASH}));
const approval=()=>({schema:'ZGMINI_ER1_NOV30_FULL_APPROVAL_V1',
 approvalState:'APPROVED_B_NOV2026_FULL',
 scope:'PC_PRIVATE_NOV2026_ER1_FUTURE_COHORT_AND_D1_SCORE_ONLY',
 sourceRepository:'ansqhd5774-Choi/zgmini',sourceSha:SOURCE,
 outputKey:'market-calendar:earnings-nov2026-er1-score-public',
 maxNewProviderRequestsPerRun:17,maxAutomaticRetries:0,
 onlyFutureScheduledDates:true,reuseExistingRawCache:true,
 requireLocalReadback:true,allowCoreWrites:false,
 allowSchedulerChanges:false,allowExistingFeedWrites:false,
 allowRawRowsPublic:false,allowDirectDeployment:false,files});
const privateResult=(patch={})=>({
 schema:'ZGMINI_NOV30_ER1_FULL_PRIVATE_V1',status:'PARTIAL',
 code:'NOV30_ER1_PROVIDER_BUDGET_STOP',providerCalls:17,d1Writes:0,
 coreWrites:0,schedulerWrites:0,existingFeedWrites:0,rawRowsPublic:0,
 ...patch});
const publishResult=(patch={})=>({
 schema:'ZGMINI_NOV30_ER1_FULL_D1_PUBLISH_V1',status:'PASS',
 code:'NOV30_ER1_D1_VERIFIED',providerCalls:0,d1Writes:1,
 coreWrites:0,schedulerWrites:0,existingFeedWrites:0,rawRowsPublic:0,
 ...patch});

test('source is exact-pinned; default request must match reviewed commit',()=>{
 assert.equal(PINNED_SOURCE_SHA,'a6dd77d19ccfcb79ddcdd0b4a6f495ec3888e24a');
 assert.throws(()=>validateRequest(event(),env),/REQUEST_CONTRACT_STOP/);
 assert.equal(validateRequest(event({...body(),sourceSha:PINNED_SOURCE_SHA}),env).sourceSha,PINNED_SOURCE_SHA);
});
test('accepts only both explicitly approved stages',()=>{
 assert.equal(validateRequest(event(),env,SOURCE).operation,'private-collect');
 assert.equal(validateRequest(event(body('score-publish')),env,SOURCE).operation,'score-publish');
 assert.throws(()=>validateRequest(event(body('shell')),env,SOURCE),/REQUEST_CONTRACT_STOP/);
});
test('rejects changed actor, missing label, incorrect source, extra field',()=>{
 assert.throws(()=>validateRequest(event(),{...env,GITHUB_ACTOR:'other'},SOURCE),/ISSUE_SCOPE_STOP/);
 assert.throws(()=>validateRequest({ ...event(),issue:{...event().issue,labels:[]}},env,SOURCE),/ISSUE_SCOPE_STOP/);
 assert.throws(()=>validateRequest(event({...body(),sourceSha:'b'.repeat(40)}),env,SOURCE),/REQUEST_CONTRACT_STOP/);
 assert.throws(()=>validateRequest(event({...body(),script:'node -e'}),env,SOURCE),/REQUEST_CONTRACT_STOP/);
});
test('approval requires exact source, fixed files, unchanged effects',()=>{
 assert.equal(validateApproval(approval(),SOURCE).sourceSha,SOURCE);
 assert.throws(()=>validateApproval({...approval(),maxNewProviderRequestsPerRun:18},SOURCE),/APPROVAL_SCOPE_STOP/);
 assert.throws(()=>validateApproval({...approval(),allowCoreWrites:true},SOURCE),/APPROVAL_SCOPE_STOP/);
 assert.throws(()=>validateApproval({...approval(),files:[files[0],files[0],files[1]]},SOURCE),/SOURCE_FILES_STOP/);
 assert.throws(()=>validateApproval({...approval(),files:[files[0],files[1],{path:files[2].path,sha256:'bad'}]},SOURCE),/SOURCE_FILES_STOP/);
});
test('private-collect accepts PARTIAL but never over budget or D1 effects',()=>{
 assert.equal(validateEffects('private-collect',privateResult()),true);
 assert.throws(()=>validateEffects('private-collect',privateResult({providerCalls:18})),/PRIVATE_EFFECT_STOP/);
 assert.throws(()=>validateEffects('private-collect',privateResult({d1Writes:1})),/PRIVATE_EFFECT_STOP/);
 assert.throws(()=>validateEffects('private-collect',privateResult({coreWrites:1})),/EFFECT_CONTRACT_STOP/);
});
test('score-publish accepts only zero provider and one or zero D1 writes',()=>{
 assert.equal(validateEffects('score-publish',publishResult()),true);
 assert.equal(validateEffects('score-publish',publishResult({d1Writes:0})),true);
 assert.throws(()=>validateEffects('score-publish',publishResult({providerCalls:1})),/PUBLISH_EFFECT_STOP/);
 assert.throws(()=>validateEffects('score-publish',publishResult({d1Writes:2})),/PUBLISH_EFFECT_STOP/);
 assert.throws(()=>validateEffects('score-publish',privateResult()),/PUBLISH_EFFECT_STOP/);
});
test('bounded report name is specific to original Issue',()=>{
 assert.equal(resultFileName(123),'nov30-full-result-123.json');
 assert.throws(()=>resultFileName(-1),/ISSUE_NUMBER_STOP/);
});
