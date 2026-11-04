// B-grade, single-operation, owner-authorized private PC job.
// Uses the already-saved November input only: never re-runs a collector.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const OWNER = 'ansqhd5774-Choi';
const PUBLIC_REPO = 'ansqhd5774-Choi/zgmini';
// Exact reviewed-and-merged main commit for public PR #968.
// Production invocation remains gated on the documented B execution contract.
const SOURCE_SHA = 'f8c7ba3f2ec407d01b9b2b57ce2c8e28b52dbac8';
const SCRIPT_SHA256 = '2d463f68ff19d387e23018cc5a9c24dfec04fe0be0ef7f0ee1f28712305a88c0';
const SOURCE_SCRIPT = path.join('scripts', 'pc-writer', 'market-calendar-nov30-publish.mjs');
const TITLE = 'pc-er1-nov30-html-publish-one-shot';
const LABEL = 'pc-er1-approved';
const NODE = String.raw`E:\ZGmini\runtime\node.exe`;
const ONCE_DIR = String.raw`E:\ZGmini\automation\er1-nov30-html-publish`;
const APPROVAL_NAME = 'ER1_NOV30_HTML_PUBLISH_B_APPROVAL.json';
const RESULT_NAME = 'ER1_NOV30_HTML_PUBLISH_RESULT.json';
const REPORT_SCHEMA = 'ZGMINI_NOV30_HTML_PUBLISH_V1';
const UUID_V4 = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const stop = code => { throw Error(code); };
const errorCode = error => /^NOV30_HTML_[A-Z0-9_]+$/.test(error?.message ?? '')
  ? error.message : 'NOV30_HTML_UNEXPECTED_STOP';

function exactFields(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === expected.slice().sort().join('|');
}

export function validateRequest(event, env) {
  if (env.GITHUB_REPOSITORY !== REPO || env.GITHUB_ACTOR !== OWNER ||
      env.GITHUB_EVENT_NAME !== 'issues' || env.GITHUB_EVENT_ACTION !== 'opened' ||
      event?.action !== 'opened' || event?.issue?.user?.login !== OWNER ||
      event?.issue?.title !== TITLE ||
      !event.issue.labels?.some(label => label.name === LABEL)) {
    stop('NOV30_HTML_ISSUE_NOT_APPROVED');
  }
  let request;
  try { request = JSON.parse(event.issue.body); }
  catch { stop('NOV30_HTML_REQUEST_JSON_STOP'); }
  if (!exactFields(request, [
    'schema', 'operation', 'requestId', 'chatId', 'sourceSha', 'from', 'through',
  ]) || request.schema !== 'ZGMINI_ER1_NOV30_HTML_PUBLISH_V1' ||
      request.operation !== 'publish-saved-november-2026-html-only' ||
      request.sourceSha !== SOURCE_SHA ||
      request.from !== '2026-11-01' || request.through !== '2026-11-30' ||
      !new RegExp('^pc-nov30-html-' + UUID_V4 + '$').test(request.requestId) ||
      !new RegExp('^chat-' + UUID_V4 + '$').test(request.chatId)) {
    stop('NOV30_HTML_REQUEST_CONTRACT_STOP');
  }
  return request;
}

const SAFE_ENV_KEYS = [
  'SystemRoot', 'WINDIR', 'PATH', 'Path', 'PATHEXT', 'ComSpec',
  'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP',
];
const safeEnv = env => Object.fromEntries(SAFE_ENV_KEYS
  .filter(key => typeof env[key] === 'string').map(key => [key, env[key]]));

export function validateApproval(approval) {
  if (!exactFields(approval, [
    'schema', 'scope', 'sourceRepository', 'sourceSha', 'sourceFile',
    'sourceFileSha256', 'expectedEvents', 'expectedDates', 'outputKeys',
    'allowProviderCalls', 'allowExistingFeedWrites', 'allowRawVendorPublic',
    'allowFormulaChanges', 'allowSchedulerChanges', 'allowDirectDeployment',
    'maxAutomaticRetries',
  ]) || approval.schema !== 'ZGMINI_ER1_NOV30_HTML_PUBLISH_APPROVAL_V1' ||
      approval.scope !== 'PC_SAVED_NOV2026_HTML_ONLY_D1_TWO_KEYS_ONE_SHOT' ||
      approval.sourceRepository !== PUBLIC_REPO || approval.sourceSha !== SOURCE_SHA ||
      approval.sourceFile !== SOURCE_SCRIPT.replaceAll('\\', '/') ||
      approval.sourceFileSha256 !== SCRIPT_SHA256 ||
      approval.expectedEvents !== 3051 || approval.expectedDates !== 30 ||
      !Array.isArray(approval.outputKeys) || approval.outputKeys.length !== 2 ||
      approval.outputKeys[0] !== 'market-calendar:earnings-nov2026-h1-display-html' ||
      approval.outputKeys[1] !== 'market-calendar:earnings-nov2026-h2-display-html' ||
      approval.allowProviderCalls !== false || approval.allowExistingFeedWrites !== false ||
      approval.allowRawVendorPublic !== false || approval.allowFormulaChanges !== false ||
      approval.allowSchedulerChanges !== false || approval.allowDirectDeployment !== false ||
      approval.maxAutomaticRetries !== 0) {
    stop('NOV30_HTML_APPROVAL_SCOPE_STOP');
  }
}

function approvedFile(workspace) {
  const f = path.join(workspace, 'control', APPROVAL_NAME);
  const stat = fs.lstatSync(f);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) {
    stop('NOV30_HTML_APPROVAL_FILE_STOP');
  }
  validateApproval(JSON.parse(fs.readFileSync(f, 'utf8')));
}

function reviewedSource(workspace) {
  if (!/^[a-f0-9]{40}$/.test(SOURCE_SHA) ||
      !/^[a-f0-9]{64}$/.test(SCRIPT_SHA256)) stop('NOV30_HTML_SOURCE_NOT_PINNED');
  const root = path.join(workspace, 'source');
  const commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8', windowsHide: true, timeout: 15000,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  if (commit !== SOURCE_SHA) stop('NOV30_HTML_SOURCE_SHA_STOP');
  const script = path.join(root, SOURCE_SCRIPT);
  const stat = fs.lstatSync(script);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 30000 ||
      sha256(fs.readFileSync(script)) !== SCRIPT_SHA256) {
    stop('NOV30_HTML_SOURCE_HASH_STOP');
  }
  return script;
}

export function validateChildReport(child) {
  if (!child || child.schema !== REPORT_SCHEMA ||
      !['PASS', 'BLOCKED', 'FAIL', 'STATE_UNKNOWN'].includes(child.status) ||
      !/^NOV30_PUBLISH_[A-Z0-9_]+$/.test(child.code ?? '') ||
      !Number.isInteger(child.providerCalls) || child.providerCalls !== 0 ||
      !Number.isInteger(child.existingFeedWrites) || child.existingFeedWrites !== 0 ||
      !Number.isInteger(child.coreWrites) || child.coreWrites !== 0 ||
      !Number.isInteger(child.schedulerWrites) || child.schedulerWrites !== 0 ||
      !Number.isInteger(child.d1Writes) || child.d1Writes < 0 || child.d1Writes > 2 ||
      !Number.isInteger(child.rawRowsPublic) || child.rawRowsPublic !== 0 ||
      ![child.eventCount, child.coreReusedDayCount, child.privateReusedDayCount]
        .every((value, index) => value === undefined ||
          (Number.isInteger(value) && value >= 0 && value <= (index === 0 ? 3051 : 30)))) {
    stop('NOV30_HTML_CHILD_REPORT_CONTRACT_STOP');
  }
  if (child.status === 'PASS' &&
      (child.eventCount !== 3051 ||
       child.coreReusedDayCount + child.privateReusedDayCount !== 30 ||
       !['NOV30_PUBLISH_D1_BOTH_VERIFIED',
         'NOV30_PUBLISH_D1_BOTH_ALREADY_MATCHED'].includes(child.code) ||
       (child.code === 'NOV30_PUBLISH_D1_BOTH_VERIFIED' && child.d1Writes === 0) ||
       (child.code === 'NOV30_PUBLISH_D1_BOTH_ALREADY_MATCHED' && child.d1Writes !== 0) ||
       !Array.isArray(child.halfRecordCounts) || child.halfRecordCounts.length !== 2 ||
       !child.halfRecordCounts.every(x => Number.isInteger(x) && x > 0 && x <= 3051) ||
       child.halfRecordCounts[0] + child.halfRecordCounts[1] !== 3051 ||
       !/^[a-f0-9]{64}$/.test(child.publicationBatchId ?? '') ||
       !/^[a-f0-9]{64}$/.test(child.localHtmlSha256H1 ?? '') ||
       !/^[a-f0-9]{64}$/.test(child.localHtmlSha256H2 ?? '') ||
       child.localHtmlSha256H1 !== child.d1ReadbackSha256H1 ||
       child.localHtmlSha256H2 !== child.d1ReadbackSha256H2)) {
    stop('NOV30_HTML_CHILD_PASS_INCOMPLETE_STOP');
  }
  // Only return explicit nonsecret summary fields, never arbitrary child payload.
  return {
    schema: REPORT_SCHEMA, status: child.status, code: child.code,
    eventCount: child.eventCount ?? 0,
    coreReusedDayCount: child.coreReusedDayCount ?? 0,
    privateReusedDayCount: child.privateReusedDayCount ?? 0,
    d1Writes: child.d1Writes, providerCalls: child.providerCalls,
    coreWrites: child.coreWrites, schedulerWrites: child.schedulerWrites,
    existingFeedWrites: child.existingFeedWrites, rawRowsPublic: child.rawRowsPublic,
    halfRecordCounts: Array.isArray(child.halfRecordCounts) &&
      child.halfRecordCounts.length === 2 &&
      child.halfRecordCounts.every(x => Number.isInteger(x) && x >= 0 && x <= 3051)
      ? child.halfRecordCounts : null,
    publicationBatchId: /^[a-f0-9]{64}$/.test(child.publicationBatchId ?? '')
      ? child.publicationBatchId : null,
    localHtmlSha256H1: /^[a-f0-9]{64}$/.test(child.localHtmlSha256H1 ?? '')
      ? child.localHtmlSha256H1 : null,
    localHtmlSha256H2: /^[a-f0-9]{64}$/.test(child.localHtmlSha256H2 ?? '')
      ? child.localHtmlSha256H2 : null,
    d1ReadbackSha256H1: /^[a-f0-9]{64}$/.test(child.d1ReadbackSha256H1 ?? '')
      ? child.d1ReadbackSha256H1 : null,
    d1ReadbackSha256H2: /^[a-f0-9]{64}$/.test(child.d1ReadbackSha256H2 ?? '')
      ? child.d1ReadbackSha256H2 : null,
  };
}

export function execute({ env = process.env } = {}) {
  let report = { schema: REPORT_SCHEMA, status: 'BLOCKED',
    code: 'NOV30_HTML_NOT_STARTED', eventCount: 0,
    providerCalls: 0, existingFeedWrites: 0, coreWrites: 0,
    schedulerWrites: 0, d1Writes: 0, rawRowsPublic: 0 };
  let workspace;
  try {
    if (process.platform !== 'win32') stop('NOV30_HTML_WINDOWS_ONLY');
    const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
    const request = validateRequest(event, env);
    workspace = env.GITHUB_WORKSPACE;
    if (!workspace || !path.isAbsolute(workspace)) stop('NOV30_HTML_WORKSPACE_STOP');
    approvedFile(workspace);
    const script = reviewedSource(workspace);
    if (!fs.existsSync(NODE)) stop('NOV30_HTML_NODE_MISSING');
    fs.mkdirSync(ONCE_DIR, { recursive: true });
    const marker = path.join(ONCE_DIR, 'ONE_SHOT_STARTED.json');
    let fd;
    try { fd = fs.openSync(marker, 'wx'); }
    catch { stop('NOV30_HTML_ALREADY_ATTEMPTED'); }
    try { fs.writeFileSync(fd, JSON.stringify({
      requestId: request.requestId, sourceSha: SOURCE_SHA, at: new Date().toISOString(),
    })); } finally { fs.closeSync(fd); }
    const childOutput = path.join(workspace, 'nov30-html-child-report.json');
    const child = spawnSync(NODE, [script, childOutput], {
      cwd: path.dirname(script), windowsHide: true, timeout: 790000,
      encoding: 'utf8', maxBuffer: 8192, env: safeEnv(env), shell: false,
    });
    if (fs.existsSync(childOutput)) {
      const stat = fs.lstatSync(childOutput);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192)
        stop('NOV30_HTML_CHILD_REPORT_FILE_STOP');
      report = { ...validateChildReport(JSON.parse(fs.readFileSync(childOutput, 'utf8'))),
        requestId: request.requestId };
    }
    if (child.error || child.signal || !fs.existsSync(childOutput)) {
      report.status = 'STATE_UNKNOWN'; report.code = 'NOV30_HTML_CHILD_RESULT_UNKNOWN';
    } else if (child.status !== 0 && report.status === 'PASS') {
      report.status = 'STATE_UNKNOWN'; report.code = 'NOV30_HTML_CHILD_EXIT_MISMATCH';
    }
  } catch (error) { report.code = errorCode(error); }
  if (workspace) {
    try { fs.writeFileSync(path.join(workspace, RESULT_NAME),
      JSON.stringify(report) + '\n', { flag: 'wx' }); }
    catch { process.stderr.write('NOV30_HTML_RESULT_SAVE_STOP\n'); }
  }
  console.log(`NOV30_HTML=${report.status} CODE=${report.code} COUNT=${report.eventCount}`);
  if (report.status !== 'PASS') process.exitCode = 1;
}

export async function upload({ env = process.env, fetcher = fetch } = {}) {
  if (!env.GITHUB_WORKSPACE) return;
  const file = path.join(env.GITHUB_WORKSPACE, RESULT_NAME);
  if (!fs.existsSync(file)) return;
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  if (!env.GITHUB_TOKEN || !Number.isInteger(event.issue.number) ||
      env.GITHUB_REPOSITORY !== REPO) return;
  const body = 'ER1 November 2026 saved HTML-only D1 publish: **' + report.status +
    '** (' + report.code + ')\n\n```json\n' + JSON.stringify(report, null, 2) + '\n```';
  const response = await fetcher(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`, {
    method: 'POST', headers: { accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`, 'content-type': 'application/json',
      'x-github-api-version': '2022-11-28' }, body: JSON.stringify({ body }),
  });
  if (!response.ok) stop('NOV30_HTML_UPLOAD_STOP');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--upload') await upload();
  else execute();
}
