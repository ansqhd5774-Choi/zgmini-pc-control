// Exactly-once post-switch diagnostic Issue reservation. The original
// maintenance ledger is never passed here and must never be written.
// The caller owns a separately approved exclusive recovery claim.

const fail = code => {throw Object.assign(new Error(code), {code});};
const need = (condition, code) => {if (!condition) fail(code);};
const sha40 = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

export function postcheckEnvelope(issue, manifest) {
  need(/^pc-update-[a-f0-9-]{36}$/.test(issue?.requestId ?? '') &&
    typeof issue.chatId === 'string' && issue.chatId.length > 3 &&
    sha40(manifest?.targetSha) && sha40(manifest?.postSourceSha) &&
    ['core-status', 'source-audit', 'fear-greed-archive-status'].includes(manifest.postOperation) &&
    typeof manifest.postSourceBranch === 'string' && /^[a-z0-9/_-]{1,70}$/.test(manifest.postSourceBranch),
  'POSTCHECK_APPROVED_ENVELOPE_INVALID');
  const body = JSON.stringify({
    schema:'ZGMINI_PC_JOB_V1',requestId:issue.requestId+'-postcheck',
    chatId:issue.chatId,operation:manifest.postOperation,
    sourceRepository:'ansqhd5774-Choi/zgmini',
    sourceBranch:manifest.postSourceBranch,sourceSha:manifest.postSourceSha,
  });
  return Object.freeze({title:`PC Update ${issue.requestId} postcheck`,
    body,labels:['pc-job'],requestId:issue.requestId+'-postcheck'});
}

function legitimate(row, descriptor) {
  return row?.title === descriptor.title && row?.body === descriptor.body &&
    row?.user?.login === 'ansqhd5774-Choi' && !row?.pull_request &&
    row?.labels?.some(label => label?.name === 'pc-job') &&
    Number.isSafeInteger(row.number) && row.number > 0;
}

function uniqueExisting(rows, descriptor) {
  need(Array.isArray(rows), 'POSTCHECK_READBACK_UNAVAILABLE');
  const contenders = rows.filter(row => row?.title === descriptor.title);
  need(contenders.every(row => legitimate(row, descriptor)), 'POSTCHECK_CONTENDER_UNTRUSTED');
  need(contenders.length <= 1, 'POSTCHECK_MULTIPLE_EXACT_ISSUES');
  return contenders[0] ?? null;
}

/**
 * listIssues must return an exhaustive bounded readback (not a search snippet),
 * including all relevant created Issues. The caller must implement page limits.
 * persist must perform atomic, request-scoped CAS on a separate recovery record.
 * No automatic rerun is permitted after an uncertain POST acknowledgement.
 */
export async function ensurePostcheckIssue({issue, manifest, record, listIssues, createIssue, persist}) {
  const descriptor = postcheckEnvelope(issue, manifest);
  need(record && typeof record === 'object' &&
    record.requestId === issue.requestId && record.claimHeld === true &&
    typeof listIssues === 'function' && typeof createIssue === 'function' &&
    typeof persist === 'function', 'POSTCHECK_RECOVERY_CLAIM_REQUIRED');
  if (record.postcheckCreationAttempted === true || record.postcheckIssueNumber != null) {
    need(record.postcheckTitle === descriptor.title &&
      record.postcheckBody === descriptor.body,
    'POSTCHECK_RECORDED_DESCRIPTOR_DRIFT');
  }
  const current = uniqueExisting(await listIssues(), descriptor);
  if (record.postcheckIssueNumber != null) {
    need(current?.number === record.postcheckIssueNumber, 'POSTCHECK_RECORDED_ISSUE_DRIFT');
    return {issueNumber:current.number,created:false,verified:true,descriptor};
  }
  if (current) {
    await persist({...record,postcheckCreationAttempted:true,
      postcheckTitle:descriptor.title,postcheckBody:descriptor.body,
      postcheckIssueNumber:current.number});
    return {issueNumber:current.number,created:false,verified:true,
      recoveredFromExisting:true,descriptor};
  }
  need(record.postcheckCreationAttempted !== true, 'POSTCHECK_OUTCOME_UNKNOWN');
  const intent = {...record,postcheckCreationAttempted:true,
    postcheckTitle:descriptor.title,postcheckBody:descriptor.body};
  // This must finish durably before the GitHub POST is issued.
  await persist(intent);
  let createdNumber=null;
  try {
    const posted=await createIssue({title:descriptor.title,
      body:descriptor.body,labels:descriptor.labels});
    need(legitimate(posted,descriptor), 'POSTCHECK_POST_IDENTITY_UNKNOWN');
    createdNumber=posted.number;
  } catch {
    // The request might have reached GitHub despite a lost acknowledgement.
    // Readback only; never issue the same POST again.
  }
  const found=uniqueExisting(await listIssues(),descriptor);
  need(found !== null && (createdNumber === null || found.number === createdNumber),
    'POSTCHECK_OUTCOME_UNKNOWN');
  await persist({...intent,postcheckIssueNumber:found.number});
  return {issueNumber:found.number,created:createdNumber !== null,verified:true,
    recoveredFromExisting:createdNumber === null,descriptor};
}
