import test from 'node:test';
import assert from 'node:assert/strict';
import {writerBCommentSummary,sanitizeWriterBResult} from '../writer-b/report.mjs';
import {queueItemNextAction} from '../agent-handoff/queue-board.mjs';
const id='01234567-89ab-4cde-8fab-0123456789ab';
const sanitize=raw=>sanitizeWriterBResult({requestId:id,...raw},id,'1234');
test('preimage failure identifies the existing guard and a concrete action without raw private values',()=>{
 const raw={status:'WRITER_B_PREFLIGHT_STOP',code:'WRITER_B_PC_PREIMAGE_STOP',preimageCheck:'HEAD',observedHead:'SECRET',message:'TOKEN=SECRET'};
 const safe=sanitize(raw),text=writerBCommentSummary(safe,2);
 assert.match(text,/`HEAD`/);assert.match(text,/기준 SHA/);assert.match(text,/기대값·실측값 상세가 포함되지 않습니다/);
 assert.doesNotMatch(text,/SECRET|TOKEN=/);assert.equal(raw.observedHead,'SECRET');
});
test('invalid preimage details cannot enter a public summary',()=>{
 const text=writerBCommentSummary(sanitize({status:'WRITER_B_PREFLIGHT_STOP',code:'WRITER_B_PC_PREIMAGE_STOP',preimageCheck:'TOKEN=SECRET'}),2);
 assert.doesNotMatch(text,/SECRET/);assert.match(text,/기존 결과 파일/);
});
test('installation receipt never asserts business publication completion',()=>{
 const text=writerBCommentSummary({status:'WRITER_B_INSTALLED_VERIFIED'},2);
 assert.match(text,/파일 설치/);assert.match(text,/실제 계산·D1 게시·API\/화면 완료는 별도/);
});
test('delivery failure cannot promote a successful local result',()=>{
 const text=writerBCommentSummary({status:'WRITER_B_INSTALLED_VERIFIED'},1);
 assert.match(text,/확인 미완료/);assert.doesNotMatch(text,/파일 설치와 설치기 사후 검증 완료/);
});
test('verified rollback is not a successful installation',()=>{
 const text=writerBCommentSummary({status:'WRITER_B_INSTALL_STOP_RESTORED'},2);
 assert.match(text,/원본 복구 확인/);assert.match(text,/설치는 미완료/);
});
test('recovery required preserves uncertain outcome and no replay advice',()=>{
 const text=writerBCommentSummary({status:'WRITER_B_RECOVERY_REQUIRED'},2);
 assert.match(text,/완료로 판정하지 않습니다/);assert.match(text,/설치 재실행은 하지 않습니다/);
});
test('dependency diagnostic names only sanitized source references',()=>{
 const safe=sanitize({status:'WRITER_B_PREFLIGHT_STOP',code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP',diagnostic:{sourceKind:'APPROVED_AFTER',sourcePath:'lib/source.mjs',dependencyPath:'lib/needed.mjs',reason:'READ_ERROR'}});
 assert.match(writerBCommentSummary(safe,2),/lib\/needed.mjs/);
});
test('idle observations lead to existing maintenance flow, not repeated waiting or killing Core',()=>{
 const safe=sanitize({status:'WRITER_B_PREFLIGHT_STOP',code:'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED',idleObservation:{windowMs:3000,samples:2,readySamples:0,activeSamples:2,otherSamples:0,maxReadyStreak:0}});
 const text=writerBCommentSummary(safe,2);assert.match(text,/실행 중 2회/);assert.match(text,/기존 유지보수/);assert.match(text,/강제 종료하지 않습니다/);
});
for(const [status,expected] of [['PENDING_OWNER_ACK',/인수 미확인/],['ACKNOWLEDGED',/업무에 착수/],['WORKING',/중복 발행 금지/],['DIAGNOSIS_EVIDENCE_RECORDED',/해결 완료가 아님/],['RESULT_EVIDENCE_RECORDED',/완료 여부 확인/],['PROOF_REVIEW_REQUIRED',/독립 업무는 계속/]]){
 test('board action preserves scope: '+status,()=>{
  const record=Object.freeze({status});assert.match(queueItemNextAction(record),expected);assert.deepEqual(record,{status});
 });
}
