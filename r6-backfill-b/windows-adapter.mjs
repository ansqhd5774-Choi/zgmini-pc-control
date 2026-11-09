// R6 one-shot Windows B host admission scaffold (SOURCE ONLY, NOT INSTALLED).
// This is intentionally NOT a pc-job command, a Controller updater, a provider
// collector, or a reusable arbitrary-callback executor. No module in this file
// opens SQLite, acquires a lock, calls a provider, or uploads a result.
//
// A future reviewed host change must supply immutable approval pins from the
// control source itself, then implement independent Windows inspections and
// the exact approved effects. Issue JSON, env values and candidate source code
// must never supply those trusted pins or PC inspection callbacks.
import { validateR6OneShotRequest, verifyR6OneShotApprovalBytes } from './contract.mjs';

export const R6_WINDOWS_B_HOST_SCHEMA = 'ZGMINI_R6_B_WINDOWS_HOST_V1';

// Deliberately unconfigured: the R6 provider+SQLite effect manifest is not
// approved. Do not derive these values from GitHub Issue/Actions env, an
// unreviewed PR or the old isolated R6 candidate source registration.
const REVIEWED_EFFECT_PINS = null;
const BOUND_RUNTIME_INSPECTORS = null;
const BOUND_EFFECT_EXECUTOR = null;

function blocked(code, requestId = null) {
  return Object.freeze({
    schema: R6_WINDOWS_B_HOST_SCHEMA,
    requestId,
    status: 'BLOCKED',
    code,
    allowProviderCalls: false,
    allowDbWrites: false,
    allowSchedulerChanges: false,
    allowD1Writes: false,
    executable: false,
    providerRequests: 0,
    retry: 'NO_AUTO_RETRY',
  });
}

const sha = (value, length) => typeof value === 'string' &&
  new RegExp(`^[a-f0-9]{${length}}$`).test(value);

// Pure isolated fixture only. It proves request+manifest bytes match a supplied
// fixture, NOT that the pins originated from a trusted workflow or that any
// PC/runtime preflight passed. Never use this return value to start a job.
export function inspectR6BApprovalContractFixture({event, env, pins, manifestBytes} = {}) {
  try {
    const request = validateR6OneShotRequest(event, env, pins);
    verifyR6OneShotApprovalBytes(manifestBytes, pins);
    return Object.freeze({
      schema: 'ZGMINI_R6_B_CONTRACT_FIXTURE_V1',
      requestId: request.requestId,
      status: 'FIXTURE_ONLY_NOT_EXECUTABLE',
      code: 'R6_B_CONTRACT_BYTES_MATCH_FIXTURE',
      executable: false,
      allowProviderCalls: false,
      allowDbWrites: false,
    });
  } catch {
    return Object.freeze({
      schema: 'ZGMINI_R6_B_CONTRACT_FIXTURE_V1',
      requestId: null,
      status: 'BLOCKED',
      code: 'R6_B_CONTRACT_FIXTURE_INVALID',
      executable: false,
      allowProviderCalls: false,
      allowDbWrites: false,
    });
  }
}

/**
 * The sole prospective Windows B host entry. Inputs are deliberately limited
 * to the event and environment; supplying custom pins, probes, executors,
 * fetch, SQLite or report callbacks cannot bypass this module's closed gate.
 *
 * Required future binding, in review order (none is implemented here):
 * 1. Reviewed immutable control/source/manifest-byte SHA pins and exact
 *    APPROVED_B_ONE_SHOT effect manifest, independent of the Issue body.
 * 2. Fixed Windows private Issue receipt and exact two-checkout/installed
 *    source, approvedSources and Core SQLite path checks.
 * 3. Genuine Core local-cycle.lock exclusive ownership held across the entire
 *    operation; independent BLS caller coverage and physical seed/journal.
 * 4. Durable unique request claim, due-only BLS batch reservation and one
 *    network guard around the existing R6 BACKFILL collector, followed by
 *    independent effect audit (no D1/source/scheduler writes).
 * 5. Token-isolated, create-only TXT/JSON result upload plus exact readback.
 *
 * A structural fixture PASS is never a capability to invoke step 4.
 */
export async function runR6BWindowsAdapter({event, env} = {}) {
  // No manifest is approved. This check precedes even reading event details,
  // so forged Issue fields, env pins or caller-supplied functions are inert.
  if (!REVIEWED_EFFECT_PINS ||
      !sha(REVIEWED_EFFECT_PINS.controlSha, 40) ||
      !sha(REVIEWED_EFFECT_PINS.sourceSha, 40) ||
      !sha(REVIEWED_EFFECT_PINS.approvalManifestSha256, 64)) {
    return blocked('R6_B_EFFECT_APPROVAL_PINS_NOT_INSTALLED');
  }

  // A future approval alone is insufficient: the Windows host's independent
  // inspectors, lease holder, one-shot journal and audited executor must all
  // be reviewed and statically bound before the operation can be exposed.
  // Deliberately no dynamic callback injection and no effectful fallback.
  if (!BOUND_RUNTIME_INSPECTORS || !BOUND_EFFECT_EXECUTOR) {
    return blocked('R6_B_TRUSTED_WINDOWS_BINDING_NOT_INSTALLED');
  }
  void event;
  void env;
  return blocked('R6_B_TRUSTED_WINDOWS_BINDING_NOT_INSTALLED');
}

