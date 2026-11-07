// Common B receiver seam for the ALREADY-IMPLEMENTED configured-theme upgrade.
// Source-only: no CLI, workflow, shell, filesystem or automatically installed receiver.
// The ONLY production entry point imports a fixed, separately approved native receiver.
// The receiver MUST own approval authentication, Git source pin, Windows evidence,
// one-shot consumption and the pinned feature-module load. None may come from an Issue.

export const SCHEMA = 'ZGMINI_CONFIGURED_RUNTIME_B_DISPATCH_V1';
export const SOURCE_REPOSITORY = 'ansqhd5774-Choi/zgmini';
export const PACKAGE_RUNNER = 'scripts/pc-writer/theme-config-package-runner.mjs';
export const REQUIRED_MODE = 'REPEATABLE_ACTIVE_RUNTIME';
export const REQUIRED_MANUAL_COMMANDS = Object.freeze([
  'THEME_REGISTER.cmd', 'THEME_LIST.cmd', 'THEME_UPDATE.cmd',
]);
const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
const TOKEN = /^[a-zA-Z0-9._-]{1,128}$/;
const TRUSTED_REQUEST_KEYS = Object.freeze([
  'requestId','sourceSha','approvalSha256',
  'packageManifestSha256','runtimePreimage',
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function need(value, code) { if (!value) fail(code); }
const plain = x => x !== null && typeof x === 'object' &&
  !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const sha40 = x => typeof x === 'string' && SHA40.test(x);
const sha64 = x => typeof x === 'string' && SHA64.test(x);
const safeCode = e => e?.code === 'ERR_MODULE_NOT_FOUND' ?
  'B_FIXED_NATIVE_RECEIVER_NOT_INSTALLED' :
  /^[A-Z0-9_]{3,100}$/.test(e?.code ?? '') ?
    e.code : 'B_RECEIVER_UNAVAILABLE_OR_FAILED';

// Deliberately not exported: production callers cannot supply a receiver as
// an Issue field. DI exercises this factory only in a source-only test.
export function createDispatcherForTrustedNativeReceiver(loadFixedReceiver) {
  need(typeof loadFixedReceiver === 'function', 'B_FIXED_RECEIVER_LOADER');
  return async function dispatch(request) {
    let phase = 'VERIFY';
    let consumed = false;
    try {
      need(plain(request) && Object.keys(request).length===
        TRUSTED_REQUEST_KEYS.length &&
        TRUSTED_REQUEST_KEYS.every(k=>Object.hasOwn(request,k)) &&
        typeof request.requestId === 'string' &&
        TOKEN.test(request.requestId), 'B_REQUEST_ID');
      // Always require the exact five values from the authenticated B action.
      // Even test callers cannot bypass Git-manifest/source preimage binding.
      need(sha40(request.sourceSha)&&
        sha64(request.approvalSha256)&&
        sha64(request.packageManifestSha256)&&
        plain(request.runtimePreimage)&&
        ['activeRuntimeSha256','taskXmlSha256','scheduledCmdSha256',
          'scheduledVbsSha256'].every(k=>
          sha64(request.runtimePreimage[k]))&&
        Object.keys(request.runtimePreimage).length===4,
      'B_REQUEST_APPROVAL_PIN');

      // Adapter is loaded by a fixed import path in the production entry point.
      // Its methods independently read the approval/source/Windows facts.
      const receiver = await loadFixedReceiver();
      need(plain(receiver) &&
        typeof receiver.verifyApprovedPackage === 'function' &&
        typeof receiver.verifyWindowsCompatibility === 'function' &&
        typeof receiver.loadPinnedPackageRunner === 'function' &&
        typeof receiver.consumeOneShotAuthorization === 'function' &&
        typeof receiver.verifyInstalledReadback === 'function',
      'B_FIXED_RECEIVER_CONTRACT');

      const approval = await receiver.verifyApprovedPackage(request.requestId);
      need(plain(approval) && approval.repository === SOURCE_REPOSITORY &&
        approval.runnerPath === PACKAGE_RUNNER &&
        approval.effect === 'CONFIGURED_THEMES_REPEAT_UPGRADE' &&
        approval.requestId === request.requestId &&
        sha40(approval.sourceSha) && sha64(approval.approvalSha256) &&
        sha64(approval.packageManifestSha256) &&
        typeof approval.packageRoot === 'string' &&
        approval.packageRoot.length > 0,
      'B_APPROVAL_SOURCE_PIN');
      need(approval.sourceSha===request.sourceSha&&
        approval.approvalSha256===request.approvalSha256&&
        approval.packageManifestSha256===request.packageManifestSha256,
      'B_APPROVAL_IDENTITY_DRIFT');

      // Existing runConfiguredPackage preflight verifies the package and
      // installed scheduled Task/CMD state; upgradeConfiguredRuntime checks
      // manual CMD3 and ACTIVE_RUNTIME preimages with its own rollback.
      // Do NOT require extra A-grade manual-command hashes as a second gate.
      // The native receiver additionally establishes Windows old/new compatibility.
      const windows = await receiver.verifyWindowsCompatibility(approval);
      need(plain(windows) && windows.os === 'win32' &&
        windows.runtimeMode === REQUIRED_MODE &&
        windows.sourceSha === approval.sourceSha &&
        sha64(windows.taskXmlSha256) &&
        sha64(windows.activeRuntimeSha256) &&
        sha64(windows.compatibilityEvidenceSha256),
      'B_WINDOWS_REPEAT_COMPATIBILITY');
      need(windows.activeRuntimeSha256===
          request.runtimePreimage.activeRuntimeSha256&&
        windows.taskXmlSha256===request.runtimePreimage.taskXmlSha256&&
        windows.scheduledCmdSha256===request.runtimePreimage.scheduledCmdSha256&&
        windows.scheduledVbsSha256===request.runtimePreimage.scheduledVbsSha256,
      'B_WINDOWS_APPROVED_PREIMAGE_DRIFT');

      const loaded = await receiver.loadPinnedPackageRunner(approval);
      need(plain(loaded) && loaded.sourceSha === approval.sourceSha &&
        loaded.packageManifestSha256 === approval.packageManifestSha256 &&
        typeof loaded.runConfiguredPackage === 'function',
      'B_PINNED_RUNNER_MISMATCH');

      const invoke = mode => loaded.runConfiguredPackage({
        mode, packageRoot: approval.packageRoot,
      });
      phase = 'PREFLIGHT';
      const preflight = await invoke('preflight');
      need(plain(preflight) && preflight.status === 'PREFLIGHT_PASS' &&
        preflight.sourceSha === approval.sourceSha &&
        preflight.manifestSha256 === approval.packageManifestSha256 &&
        preflight.changed === 0,
      'B_CONFIG_PACKAGE_PREFLIGHT');

      // Consume, do not merely check, the approved one-shot capability.
      // Any uncertain state AFTER this point must be inspected, never retried.
      phase = 'RESERVE';
      // The receiver may have consumed authority even if it subsequently
      // times out or returns a malformed receipt. Never classify as retryable.
      consumed = true;
      const receipt = await receiver.consumeOneShotAuthorization({
        approval, windows, preflight,
      });
      need(plain(receipt) && receipt.requestId === request.requestId &&
        receipt.approvalSha256 === approval.approvalSha256 &&
        receipt.sourceSha === approval.sourceSha &&
        sha64(receipt.receiptSha256),
      'B_ONESHOT_RECEIPT');
      phase = 'INSTALL';
      const result = await invoke('install');
      need(plain(result) &&
        result.status === 'CONFIGURED_AUTO_PUBLISH_UPGRADE_INSTALLED' &&
        result.sourceSha === approval.sourceSha && result.changed === 1,
      'B_CONFIG_PACKAGE_INSTALL_UNCERTAIN');

      phase = 'READBACK';
      const readback = await receiver.verifyInstalledReadback({
        approval, windows, receipt, result,
      });
      need(plain(readback) && readback.status === 'VERIFIED' &&
        readback.sourceSha === approval.sourceSha &&
        readback.packageManifestSha256 === approval.packageManifestSha256 &&
        readback.taskXmlSha256 === windows.taskXmlSha256 &&
        readback.activeRuntimeVersion &&
        readback.manualCommandsVerified === 3 &&
        readback.rollbackRecordVerified === true,
      'B_INSTALLED_READBACK_UNCERTAIN');

      return Object.freeze({schema: SCHEMA, status: 'DONE',
        requestId: request.requestId, sourceSha: approval.sourceSha,
        installedVersion: readback.activeRuntimeVersion,
        reservation: receipt.receiptSha256,
        verified: 'PC_RUNTIME_SOURCE_TASK_MANUAL_ACTIVE_ROLLBACK'});
    } catch (error) {
      return Object.freeze({schema: SCHEMA,
        status: consumed ? 'STATE_UNKNOWN' : 'BLOCKED',
        reason: safeCode(error), phase,
        effectAttempted: consumed,
        retryAllowed: false});
    }
  };
}

// This file does not install this module. Without the separately approved,
// locally pinned fixed receiver, this import cannot yield an effectful runner.
export const dispatchConfiguredRuntimeB =
  createDispatcherForTrustedNativeReceiver(async () => {
    const native = await import('./configured-runtime-b-fixed-receiver.mjs');
    return native.default;
  });
