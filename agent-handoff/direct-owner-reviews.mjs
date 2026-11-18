// Read-only central owner review index. An Issue is not a B approval or PC result.
import {HANDOFF_OWNER,HANDOFF_REPOSITORY} from './queue-selector.mjs';
const API='https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/';
const LINK='https://github.com/'+HANDOFF_REPOSITORY+'/issues/';
export const DIRECT_OWNER_REVIEWS=Object.freeze([
 Object.freeze({key:'W01_CONTROLLER',worker:'W01',originCommentId:6937716167,
   textProof:'W01 물가',reviewIssue:1871,reviewType:'PR',reviewTitle:'W01 Controller'}),
 Object.freeze({key:'W03_R47_CMD',worker:'W03',originCommentId:6937230843,
   textProof:'R47 CMD',reviewIssue:1892,reviewType:'PR',reviewTitle:'R47 CMD'}),
 Object.freeze({key:'W04_PIT0403',worker:'W04',originCommentId:6937150103,
   textProof:'W04 PIT-04-03',reviewIssue:1878,reviewType:'PR',reviewTitle:'PIT-04-03'}),
 Object.freeze({key:'W05_WPSFD42',worker:'W05',originCommentId:6937746172,
   textProof:'W05 R3-04',reviewIssue:1885,reviewType:'ISSUE',reviewTitle:'W05 R3-04'})
]);
const fail=code=>{throw Error('DIRECT_OWNER_BOARD_'+code);};
function verifiedOrigin(s,origin){
 return origin?.id===s.originCommentId&&origin.user?.login===HANDOFF_OWNER&&
   origin.issue_url===API+'issues/68'&&typeof origin.body==='string'&&
   origin.body.includes(s.textProof);
}
function verifiedReview(s,review){
 return review?.number===s.reviewIssue&&
   review.repository_url===API.slice(0,-1)&&
   ['open','closed'].includes(review.state)&&
   typeof review.title==='string'&&review.title.includes(s.reviewTitle)&&
   (s.reviewType==='PR'?Boolean(review.pull_request):!review.pull_request);
}
export function compileDirectOwnerBoard(readbacks,nowMs){
 if(!Array.isArray(readbacks)||readbacks.length!==DIRECT_OWNER_REVIEWS.length||
   !Number.isFinite(nowMs)||nowMs<Date.UTC(2020,0,1))fail('INPUT_INVALID');
 const records=DIRECT_OWNER_REVIEWS.map((s,i)=>{
   const x=readbacks[i],sourceValid=verifiedOrigin(s,x?.origin);
   const reviewValid=verifiedReview(s,x?.review);
   const state=!sourceValid?'ORIGIN_PROOF_UNVERIFIED':
     !reviewValid?'REVIEW_PROOF_UNVERIFIED':
     x.review.state==='open'?'REVIEW_OPEN':'REVIEW_CLOSED_RUNTIME_UNVERIFIED';
   return Object.freeze({key:s.key,worker:s.worker,originCommentId:s.originCommentId,
     originUrl:LINK+'68#issuecomment-'+s.originCommentId,
     reviewIssue:s.reviewIssue,reviewUrl:LINK+s.reviewIssue,
     reviewType:s.reviewType,state,
     sourceAccountVerified:sourceValid,reviewIssueVerified:reviewValid,
     chatSessionVerified:false,bApprovalVerified:false,
     pcRuntimeVerified:false,operationalWrites:0});
 });
 return Object.freeze({schema:'ZGMINI_CENTRAL_DIRECT_OWNER_BOARD_R1',
   asOf:new Date(nowMs).toISOString(),advisoryOnly:true,
   intakeCount:records.length,
   verifiedOriginCount:records.filter(x=>x.sourceAccountVerified).length,
   verifiedReviewCount:records.filter(x=>x.reviewIssueVerified).length,
   records,pcOperationalWrites:0,aiCalls:0,automaticRetries:0});
}
export function renderDirectOwnerMarkdown(board){
 if(board?.schema!=='ZGMINI_CENTRAL_DIRECT_OWNER_BOARD_R1')fail('OUTPUT_SCHEMA');
 const lines=['','## 중앙 #68 직접 담당 인계 (자동 장애 Incident와 별도)','',
   '실접수 참조: **'+board.intakeCount+'건** / 출처 계정 확인 **'+
    board.verifiedOriginCount+'건** / 검토 Issue 확인 **'+board.verifiedReviewCount+'건**',
   '','| 담당 | 중앙 원본 댓글 | 공통 검토 | 검증 상태 |',
   '|---|---|---|---|'];
 for(const r of board.records)
   lines.push('| '+r.worker+' | [#68/'+r.originCommentId+']('+r.originUrl+') | [#'+
     r.reviewIssue+']('+r.reviewUrl+') | '+r.state+' |');
 lines.push('','- 자동 agent-handoff 대기 Issue와 직접 요청은 별도 지표이며 고유 업무 수로 단순 합산하지 않습니다.',
   '- GitHub 계정과 검토 기록만 검증합니다. 다른 ChatGPT 대화 수신, B 승인, 실제 PC 설치는 인증하지 않습니다.',
   '- 이 목록은 알려진 직접 요청 4건의 색인입니다. 새로운 직접 요청 전체를 자동 발견했다는 뜻은 아닙니다.',
   '- 공유 Controller와 Writer의 설치/수집/게시 실행은 기존 승인된 원담당 경로를 따릅니다.');
 return lines.join('\n')+'\n';
}
