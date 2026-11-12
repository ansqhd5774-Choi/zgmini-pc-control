// Exact deterministic GitHub result receipts, shared by the writer and
// read-only owner review. No network, filesystem, execution or authorization.
export function centralResultReceipt(handoff,result,digest,repo,verified){
  return [
    'HANDOFF_RESULT_RECORDED', 'resultId: '+result.resultId,
    'digest: '+digest, 'incidentId: '+result.incidentId,
    'fingerprint: '+result.fingerprint,
    'origin: '+handoff.origin.repository+'#'+handoff.origin.issueNumber,
    'pr: '+repo+'#'+result.pullRequest.number,
    'prHeadSha: '+result.pullRequest.headSha,
    'testRunId: '+result.testRun.runId, 'state: '+verified.state,
    'ChatGPT owner received: UNKNOWN',
    'Windows/D1/API/UI verification: NOT_VERIFIED',
    'PC retries: 0', 'operationalWrites: 0',
  ].join('\n');
}
export function originResultReceipt(result,digest,repo,verified,handoffIssueNumber){
  return [
    'HANDOFF_ORIGIN_RESULT_RECORDED', 'resultId: '+result.resultId,
    'digest: '+digest,'incidentId: '+result.incidentId,
    'handoffIssue: '+handoffIssueNumber,
    'fixPr: '+repo+'#'+result.pullRequest.number,
    'prHeadSha: '+result.pullRequest.headSha,
    'testRunId: '+result.testRun.runId, 'state: '+verified.state,
    'ChatGPT owner received: UNKNOWN',
    'Windows/D1/API/UI verification: NOT_VERIFIED',
    'PC retries: 0', 'operationalWrites: 0',
  ].join('\n');
}
