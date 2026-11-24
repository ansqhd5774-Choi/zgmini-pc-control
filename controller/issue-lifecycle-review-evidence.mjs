/**
 * Read-only adapter for evidence fetched by a trusted GitHub API client.
 * This module never fetches, approves, signs, or changes GitHub state.
 * Callers must authenticate the snapshots and pin the commit used for files.
 */
const fail = reason => ({verified:false,reason});
const fixedFields = ['schema','jobId','requestId','controlRepository','controlSourceSha',
  'sourceRepository','requestedSourceSha','sourceBranch','operation','seat','status',
  'code','firstFail','exitCode','operationalWrites','providerCalls','d1Writes',
  'protectedStateUnchanged','protectedBeforeSha256','protectedAfterSha256','actualExecutionSha'];
const scalar = x => x === null ? 'null' : typeof x === 'string' ? x :
  typeof x === 'number' && Number.isFinite(x) ? String(x) :
  typeof x === 'boolean' ? String(x) : null;
const validRun = v => typeof v === 'string' && /^[0-9]{1,20}$/.test(v);
export function verifyPcJobReceiptPair({issue,run,comment,jsonText,txtText,attempt,seat} = {}) {
  if (!issue || !run || !comment || typeof jsonText !== 'string' ||
      typeof txtText !== 'string') return fail('MISSING_TRUSTED_SNAPSHOT');
  const runId=String(run.id??'');
  if (!validRun(runId) || !Number.isSafeInteger(attempt) || attempt < 1 || attempt > 999 ||
      !Number.isSafeInteger(seat) || seat < 1 || seat > 6) return fail('INVALID_JOB_ID');
  if (run.status !== 'completed' || run.conclusion !== 'success' ||
      run.run_attempt !== attempt) return fail('GITHUB_RUN_NOT_SUCCESS');
  // A successful unrelated workflow cannot attest an issues-triggered PC job.
  if (run.event !== 'issues' || run.name !== 'ZGMINI PC Job' ||
      run.repository?.full_name !== 'ansqhd5774-Choi/zgmini-pc-control')
    return fail('RUN_PROVENANCE_UNVERIFIED');
  const jobId=`run-${runId}-${attempt}-seat-${seat}`;
  let report;
  try { report=JSON.parse(jsonText); } catch { return fail('INVALID_JSON'); }
  if (!report || typeof report !== 'object' || Array.isArray(report) ||
      report.jobId !== jobId || report.seat !== seat) return fail('REPORT_ID_MISMATCH');
  const entries=new Map();
  for (const row of txtText.split(/\r?\n/).filter(Boolean)) {
    const separator=row.indexOf('=');
    if (separator < 1) return fail('INVALID_TXT');
    const key=row.slice(0,separator),value=row.slice(separator+1);
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key) || entries.has(key)) return fail('INVALID_TXT');
    entries.set(key,value);
  }
  for (const field of fixedFields) {
    const expected=scalar(report[field]);
    if (expected===null || entries.get(field)!==expected) return fail('PAIR_FIELD_MISMATCH');
  }
  const marker=`<!-- zgmini-pc-result:${runId}:${attempt}:${seat} -->`;
  if (comment.user?.login !== 'github-actions[bot]' ||
      typeof comment.body !== 'string' || !comment.body.includes(marker) ||
      !comment.body.includes(`results/${runId}-${attempt}-seat-${seat}.json`) ||
      !comment.body.includes(`results/${runId}-${attempt}-seat-${seat}.txt`))
    return fail('RESULT_COMMENT_UNVERIFIED');
  // Upload posts the exact JSON/TXT bytes in the bot comment, not just links.
  const fence=String.fromCharCode(96).repeat(3);
  const jsonFence=fence+'json\n'+jsonText+fence;
  const txtFence=fence+'text\n'+txtText+fence;
  const commentBody=comment.body;
  if(!commentBody.startsWith(marker+'\n') ||
     !commentBody.includes(jsonFence) || !commentBody.includes(txtFence) ||
     commentBody.indexOf(jsonFence)!==commentBody.lastIndexOf(jsonFence) ||
     commentBody.indexOf(txtFence)!==commentBody.lastIndexOf(txtFence))
    return fail('RESULT_COMMENT_CONTENT_MISMATCH');
  let request;
  try {request=JSON.parse(issue.body);} catch {return fail('ISSUE_BODY_INVALID');}
  if (!request || typeof request!=='object' || Array.isArray(request) ||
      issue.state!=='open' || !Number.isSafeInteger(issue.number) ||
      request.schema!=='ZGMINI_PC_JOB_V1' ||
      !request.requestId || request.requestId!==report.requestId ||
      request.operation!==report.operation ||
      request.sourceRepository!==report.sourceRepository ||
      request.sourceBranch!==report.sourceBranch ||
      request.sourceSha!==report.requestedSourceSha ||
      report.schema!=='ZGMINI_PC_RESULT_V1' ||
      report.controlRepository!=='ansqhd5774-Choi/zgmini-pc-control')
    return fail('ISSUE_REQUEST_MISMATCH');
  if (report.reportTransfer?.status==='SUMMARY_ONLY' ||
      report.result?.inventoryTruncated===true) return fail('PARTIAL_REPORT');
  return Object.freeze({verified:true,reason:'READONLY_RECEIPT_PAIR_MATCHED',
    report,evidence:Object.freeze({issueNumber:issue.number,requestId:request.requestId,
      runId,attempt,seat,jsonVerified:true,txtVerified:true,
      commentVerified:true,runConcludedSuccessfully:true})});
}
