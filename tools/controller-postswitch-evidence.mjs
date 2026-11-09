// Fixed-root, read-only evidence for a controller update interrupted after intake resume.
// This tool never replays a request, modifies a journal, releases a lease or installs files.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const control = 'E:/ZGmini/automation/pc-control';
const maintenance = 'E:/ZGmini/automation/pc-maintenance';
const gh = 'C:/Program Files/GitHub CLI/gh.exe';
const repository = 'ansqhd5774-Choi/zgmini-pc-control';
const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const digest = value => createHash('sha256').update(value).digest('hex');
const need = (ok, code) => {if (!ok) throw Object.assign(new Error(code), {code});};
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const alive = pid => {try {process.kill(pid, 0); return true;} catch (error) {return error.code === 'ESRCH' ? false : null;}};

export function verifyControllerFiles(host, root, readBytes = fs.readFileSync) {
  if (!host || !isSha(host.controllerSourceSha) || !host.controllerFiles ||
      Array.isArray(host.controllerFiles) || typeof host.controllerFiles !== 'object') return false;
  const files = Object.entries(host.controllerFiles);
  if (files.length < 5) return false;
  return files.every(([rel, hash]) =>
    /^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(rel) &&
    /^[a-f0-9]{64}$/.test(hash) &&
    (() => {try {return digest(readBytes(path.join(root, rel))) === hash;} catch {return false;}})());
}

// #917 is a fixed 38-file post-switch incident. A self-consistent but reduced
// host.json (37/37 etc.) must not silently pass the C-grade recovery gate.
export function verifyExactPostSwitchInventory(currentHost, backupHost,
  currentSourcePaths, backupSourcePaths) {
  const set = items => Array.isArray(items) && items.length === 38 &&
    items.every(p => /^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(p)) &&
    new Set(items).size === 38 ? [...items].sort().join('\n') : null;
  const current = set(Object.keys(currentHost?.controllerFiles ?? {}));
  const backup = set(Object.keys(backupHost?.controllerFiles ?? {}));
  return current !== null && backup !== null && current === backup &&
    current === set(currentSourcePaths) && backup === set(backupSourcePaths);
}

export function verifySourceBytes(host, sourceSha, readPinnedBlob) {
  if (!host || host.controllerSourceSha !== sourceSha ||
      typeof readPinnedBlob !== 'function' ||
      !host.controllerFiles || typeof host.controllerFiles !== 'object') return false;
  return Object.entries(host.controllerFiles).every(([rel, expected]) => {
    try {return /^[a-f0-9]{64}$/.test(expected) &&
      digest(readPinnedBlob(sourceSha, rel)) === expected;}
    catch {return false;}
  });
}

export function verifySupervisorSnapshot(status, owner, {targetSha,
  livePid = alive, now = Date.now(), bootAt = now - os.uptime() * 1000} = {}) {
  if (status?.mode !== 'LISTENING' || status?.sourceSha !== targetSha ||
      !Number.isSafeInteger(status.pid) || status.pid < 1 ||
      owner?.pid !== status.pid || !/^[a-f0-9-]{36}$/.test(owner?.nonce ?? '') ||
      !Number.isFinite(owner?.bootAt) || Math.abs(owner.bootAt - bootAt) > 10000 ||
      livePid(status.pid) !== true || !Array.isArray(status.children) ||
      status.children.length !== 6 ||
      !Number.isFinite(Date.parse(status.at ?? '')) ||
      now - Date.parse(status.at) < 0 || now - Date.parse(status.at) >= 45000) return false;
  const seats = new Set();
  for (const child of status.children) {
    if (!Number.isInteger(child?.seat) || child.seat < 1 || child.seat > 6 ||
        seats.has(child.seat) || child.alive !== true ||
        !Number.isSafeInteger(child.pid) || child.pid < 1 ||
        livePid(child.pid) !== true) return false;
    seats.add(child.seat);
  }
  return seats.size === 6;
}

export function classifyPostSwitchEvidence(evidence) {
  const checks = {
    ORIGINAL_LEDGER: evidence.ledger?.status === 'RECOVERY_REQUIRED' &&
      evidence.ledger?.phase === 'RECOVERY_REQUIRED' &&
      evidence.ledger?.firstFail === 'INTAKE_RESUMED' &&
      evidence.ledger?.code === 'BACKLOG_ORIGINAL_REQUEST_INVALID' &&
      evidence.ledger?.intakePaused === false &&
      evidence.ledger?.postIssueNumber == null,
    TARGET_SWITCHED: evidence.currentSha === evidence.ledger?.targetSha &&
      evidence.currentSha !== evidence.ledger?.installedShaBefore &&
      evidence.currentBytesVerified === true,
    BACKUP_VERIFIED: evidence.snapshotSha === evidence.ledger?.installedShaBefore &&
      evidence.snapshotBytesVerified === true,
    OWNER_DEAD_AND_MATCHED: evidence.ownerIdentityVerified === true && evidence.ownerAlive === false,
    PROTECTION_UNCHANGED: evidence.protectionVerified === true,
    BACKLOG_CLOSED: evidence.backlogVerified === true && evidence.pauseWindowsClosed === true,
    LIVE_WORKFLOW_ACTIVE: evidence.workflow === 'active',
    RUNNERS_ONLINE: evidence.runnerSetVerified === true,
    SUPERVISOR_FRESH: evidence.supervisorVerified === true,
  };
  const failed = Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name);
  return {status: failed.length ? 'RECOVERY_REQUIRED' : 'READONLY_POSTSWITCH_EVIDENCE_VERIFIED',
    code: failed[0] ?? 'POSTSWITCH_EVIDENCE_VERIFIED', checks,
    next: failed.length ? 'RECONCILE_NAMED_CHECKS_WITHOUT_OPERATIONAL_WRITE' :
      'PREPARE_EXACT_APPROVAL_AND_ISOLATED_FORWARD_RECOVERY_NO_AUTOMATIC_EXECUTION'};
}

// The six dedicated PC seats must each be uniquely registered and online.
// Additional independently scoped runners (for example, handoff CI spares)
// are unrelated to the recovery of these seats and must not create a false
// shared-Controller outage.
export function verifyNamedPcRunnersOnline(rows) {
  if (!Array.isArray(rows)) return false;
  const names = Array.from({length: 6}, (_, index) => `zgmini-pc-0${index + 1}`);
  return names.every(name => {
    const matches = rows.filter(row => row?.name === name);
    return matches.length === 1 && matches[0].status === 'online';
  });
}

function readGitHub(route) {
  return JSON.parse(execFileSync(gh, ['api', `repos/${repository}/${route}`],
    {encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 3e6}));
}

export async function main(args = process.argv.slice(2)) {
  need(process.platform === 'win32' && !process.env.GITHUB_ACTIONS && !process.env.RUNNER_NAME,
    'POSTSWITCH_OPERATOR_WINDOWS_REQUIRED');
  need(args.length === 4 && args[0] === '--request-id' && args[2] === '--source-sha' &&
    /^pc-update-[a-f0-9-]{36}$/.test(args[1]) && isSha(args[3]), 'POSTSWITCH_USAGE');
  const id = args[1], source = args[3];
  const git = params => execFileSync('git', params, {cwd: repo, windowsHide: true, maxBuffer: 4e6});
  git(['merge-base', '--is-ancestor', source, 'HEAD']);
  need(digest(git(['show', `${source}:tools/controller-postswitch-evidence.mjs`])) ===
    digest(fs.readFileSync(fileURLToPath(import.meta.url))), 'POSTSWITCH_SOURCE_DRIFT');
  // Import closure of update.mjs: maintenance-contract.mjs re-exports the
  // source-bundle contract, and update.mjs imports that module directly too.
  // Every local non-builtin import must match the pinned recovery source.
  for (const rel of ['tools/update.mjs', 'tools/maintenance-apply.mjs',
    'tools/maintenance-contract.mjs', 'tools/maintenance-lock.mjs',
    'tools/source-bundle-register.mjs']) {
    need(digest(git(['show', `${source}:${rel}`])) === digest(fs.readFileSync(path.join(repo, rel))),
      'POSTSWITCH_DEPENDENCY_DRIFT');
  }

  const ledgerPath = path.join(maintenance, 'ledger', `${id}.json`);
  const ledgerRaw = fs.readFileSync(ledgerPath), ledger = JSON.parse(ledgerRaw);
  const dir = path.join(maintenance, 'leases/controller-install');
  const ownerRaw = fs.readFileSync(path.join(dir, 'owner.json'));
  const markerRaw = fs.readFileSync(path.join(dir, 'RECOVERY_REQUIRED.json'));
  const owner = JSON.parse(ownerRaw), marker = JSON.parse(markerRaw);
  const original = readGitHub(`issues/${ledger.issueNumber}`);
  let issueBody = null;
  try {issueBody = JSON.parse(original.body);} catch {}
  const ownerIdentityVerified = ledger.requestId === id && Number.isSafeInteger(owner.pid) && owner.pid > 0 &&
    /^[0-9a-f-]{36}$/.test(owner.nonce ?? '') && marker.requestOwnerPid === owner.pid && marker.nonce === owner.nonce &&
    Number.isFinite(Date.parse(ledger.updatedAt)) && Number.isFinite(Date.parse(marker.at)) &&
    Math.abs(Date.parse(marker.at) - Date.parse(ledger.updatedAt)) < 5000 &&
    Number.isFinite(Date.parse(owner.at)) && Date.parse(owner.at) <= Date.parse(marker.at) &&
    original.title === 'pc-controller-update' && original.user?.login === 'ansqhd5774-Choi' &&
    issueBody?.requestId === id && issueBody?.targetControllerSha === ledger.targetSha;

  const currentHostRaw = fs.readFileSync(path.join(control, 'host.json'));
  const currentHost = JSON.parse(currentHostRaw);
  const base = path.join(control, 'backups', `controller-update-${id}`);
  const snapshotHostPath = path.join(base, 'snapshot', 'host.json');
  const snapshotHostRaw = fs.readFileSync(snapshotHostPath);
  const snapshotHost = JSON.parse(snapshotHostRaw);
  const sourcePaths = sha => git(['ls-tree', '-r', '--name-only', sha]).toString('utf8')
    .split(/\r?\n/).filter(p => /^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(p));
  const exactInventories = verifyExactPostSwitchInventory(currentHost, snapshotHost,
    sourcePaths(ledger.targetSha), sourcePaths(ledger.installedShaBefore));
  const sourceBlob = (sha, rel) => git(['show', `${sha}:${rel}`]);
  const exactSourceBytes = exactInventories &&
    verifySourceBytes(currentHost, ledger.targetSha, sourceBlob) &&
    verifySourceBytes(snapshotHost, ledger.installedShaBefore, sourceBlob);
  const baselinePath = path.join(base, 'PROTECTED_BEFORE.json');
  const baselineExists = fs.existsSync(baselinePath);
  const backlogPath = path.join(maintenance, 'backlog', `${id}.json`);
  const backlogRaw = fs.readFileSync(backlogPath), backlog = JSON.parse(backlogRaw);
  const windows = Array.isArray(backlog.windows) ? backlog.windows :
    [{pausedAt: backlog.pausedAt, resumedAt: backlog.resumedAt}];
  const pauseWindowsClosed = windows.length > 0 && windows.every(w =>
    Number.isFinite(Date.parse(w.pausedAt)) && Number.isFinite(Date.parse(w.resumedAt)) &&
    Date.parse(w.resumedAt) >= Date.parse(w.pausedAt));
  const backlogVerified = backlog.schema === 'ZGMINI_PC_BACKLOG_V1' && backlog.requestId === id &&
    backlog.replays && typeof backlog.replays === 'object' && !Array.isArray(backlog.replays) &&
    Object.entries(backlog.replays).every(([issue, entry]) => /^\d{1,10}$/.test(issue) &&
      ['DONE', 'SKIPPED_RESULT_PRESENT', 'POSTING'].includes(entry?.status));

  // Reuse the exact existing maintenance protection attestation: Core/Korea
  // scheduled task XML, writer configs, retired Iran approval, real workflow,
  // and every closed maintenance pause interval. All these port calls are reads.
  let protectionVerified = false, protectionCode = null;
  let currentInventoryComplete = false, snapshotInventoryComplete = false;
  if (baselineExists && backlogVerified) {
    try {
      const {loadApprovedPackage, makePorts, prevalidationInventory} = await import('./update.mjs');
      const data = loadApprovedPackage(id, path.join(maintenance, 'approved', `${id}.json`), {recovery: true});
      currentInventoryComplete = prevalidationInventory(currentHost) !== null;
      snapshotInventoryComplete = prevalidationInventory(snapshotHost) !== null;
      const {ports} = makePorts(data, data.issueNumber, {recoveryOperator: true});
      await ports.prepareRecovery();
      protectionVerified = true;
    } catch (error) {protectionCode = /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code :
      'POSTSWITCH_PROTECTION_READBACK_FAILED';}
  }

  const runnerRows = readGitHub('actions/runners?per_page=100').runners;
  const runnerSetVerified = verifyNamedPcRunnersOnline(runnerRows);
  const workflow = readGitHub('actions/workflows/pc-job.yml').state;
  let supervisorVerified = false;
  try {
    const supervisor = json(path.join(control, 'SUPERVISOR_STATUS.json'));
    const supervisorOwner = json(path.join(control, 'leases/supervisor/owner.json'));
    supervisorVerified = verifySupervisorSnapshot(supervisor, supervisorOwner,
      {targetSha: ledger.targetSha});
  } catch {}
  const otherControlLeaseCount = fs.readdirSync(path.join(control, 'leases')).filter(name =>
    name !== 'supervisor' && !name.startsWith('supervisor.dead-')).length;
  const decision = classifyPostSwitchEvidence({ledger,
    currentSha: currentHost.controllerSourceSha,
    currentBytesVerified: exactSourceBytes && currentInventoryComplete &&
      verifyControllerFiles(currentHost, control),
    snapshotSha: snapshotHost.controllerSourceSha,
    snapshotBytesVerified: exactSourceBytes && snapshotInventoryComplete &&
      verifyControllerFiles(snapshotHost, path.join(base, 'snapshot')),
    ownerIdentityVerified, ownerAlive: alive(owner.pid), protectionVerified,
    backlogVerified, pauseWindowsClosed, workflow, runnerSetVerified, supervisorVerified,
    otherControlLeaseCount});
  const replayStates = Object.fromEntries(Object.entries(backlog.replays || {})
    .filter(([issue]) => /^\d{1,10}$/.test(issue))
    .map(([issue, entry]) => [issue,
      ['DONE', 'SKIPPED_RESULT_PRESENT', 'POSTING'].includes(entry?.status) ? entry.status : 'UNKNOWN']));
  return {schema: 'ZGMINI_PC_POSTSWITCH_EVIDENCE_V1', requestId: id, sourceSha: source,
    ...decision, actualControllerSha: currentHost.controllerSourceSha,
    installedShaBefore: ledger.installedShaBefore, backupSha: snapshotHost.controllerSourceSha,
    materialHashes: {ledger: digest(ledgerRaw), owner: digest(ownerRaw), marker: digest(markerRaw),
      currentHost: digest(currentHostRaw),
      snapshotHost: digest(snapshotHostRaw),
      protectedBefore: baselineExists ? digest(fs.readFileSync(baselinePath)) : null,
      backlog: digest(backlogRaw)},
    backlogReplayStates: replayStates,
    protectionCode, exactInventories, exactSourceBytes, otherControlLeaseCount, operationalWrites: 0};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await main();
    console.log(JSON.stringify(result));
    if (result.status !== 'READONLY_POSTSWITCH_EVIDENCE_VERIFIED') process.exitCode = 2;
  }
  catch (error) {console.log(JSON.stringify({status: 'RECOVERY_REQUIRED',
    code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'POSTSWITCH_INSPECTION_FAILED',
    next: 'READ_ONLY_RECONCILE_NO_INSTALL_OR_LOCK_CHANGE', operationalWrites: 0}));
    process.exitCode = 2;}
}
