// Proposed, INACTIVE R6 one-shot B contract. This module never executes jobs.
// A separately approved immutable manifest and PC admission are mandatory.
import { createHash } from "node:crypto";
const stop = code => { throw Error(`R6_B_${code}`); };
const hex = (s, n) => typeof s === "string" && new RegExp(`^[a-f0-9]{${n}}$`).test(s);
const uuid = s => typeof s === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s);
const exact = (value, keys) => value && typeof value === "object"
  && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|");

export const R6_ONE_SHOT = Object.freeze({
  schema: "ZGMINI_EMPLOYMENT_R6_BACKFILL_B_V1",
  approvalSchema: "ZGMINI_EMPLOYMENT_R6_BACKFILL_B_APPROVAL_V1",
  repository: "ansqhd5774-Choi/zgmini-pc-control",
  sourceRepository: "ansqhd5774-Choi/zgmini",
  owner: "ansqhd5774-Choi",
  issueTitle: "pc-employment-r6-backfill-one-shot",
  issueLabel: "pc-employment-r6-backfill-b",
  scope: "PC_LOCAL_R6_BACKFILL_RAW_APPEND_ONLY",
  maxBlsRequests: 18,
  maxDolRequests: 2,
  maxTotalRequests: 20,
  blsUnregistered24hLimit: 25,
  groups: Object.freeze({
    DOL_UI_WEEKLY_CLAIMS: 0,
    BLS_EMPLOYMENT_SITUATION: 2,
    BLS_JOLTS: 2,
    BLS_ECI: 2,
    BLS_STATE_MSA: 2,
    BLS_BED: 10,
  }),
});

export function validateR6OneShotRequest(event, env, pins) {
  if (env?.GITHUB_REPOSITORY !== R6_ONE_SHOT.repository ||
    env?.GITHUB_ACTOR !== R6_ONE_SHOT.owner ||
    env?.GITHUB_EVENT_NAME !== "issues" ||
    env?.GITHUB_EVENT_ACTION !== "opened" ||
    event?.action !== "opened" ||
    event?.repository?.private !== true ||
    event?.issue?.user?.login !== R6_ONE_SHOT.owner ||
    event?.issue?.title !== R6_ONE_SHOT.issueTitle ||
    !event?.issue?.labels?.some(x => x?.name === R6_ONE_SHOT.issueLabel))
    stop("ISSUE_SCOPE_STOP");
  let request;
  try { request = JSON.parse(event.issue.body); } catch { stop("REQUEST_JSON_STOP"); }
  if (!exact(request, ["schema", "operation", "requestId", "chatId", "sourceSha", "controlSha", "approvalManifestSha256"]) ||
    request.schema !== R6_ONE_SHOT.schema ||
    request.operation !== "employment-r6-backfill-once" ||
    !uuid(request.requestId) || !uuid(request.chatId) ||
    !hex(request.sourceSha, 40) || !hex(request.controlSha, 40) ||
    !hex(request.approvalManifestSha256, 64))
    stop("REQUEST_CONTRACT_STOP");
  if (!pins || !hex(pins.sourceSha, 40) || !hex(pins.controlSha, 40) ||
    !hex(pins.approvalManifestSha256, 64) ||
    request.sourceSha !== pins.sourceSha || request.controlSha !== pins.controlSha ||
    request.approvalManifestSha256 !== pins.approvalManifestSha256)
    stop("IMMUTABLE_PIN_STOP");
  return request;
}

export function validateR6OneShotApproval(manifest, pins) {
  if (!hex(pins?.sourceSha, 40) || !hex(pins?.controlSha, 40) ||
    !exact(manifest, ["schema", "approvalState", "scope", "sourceRepository", "sourceSha", "controlSha", "runCount", "maxBlsRequests", "maxDolRequests", "maxTotalRequests", "blsUnregistered24hLimit", "allowProviderCalls", "allowLocalRawDbWrites", "allowD1Writes", "allowSchedulerChanges", "allowCoreSourceChanges", "maxAutomaticRetries"]) ||
    manifest.schema !== R6_ONE_SHOT.approvalSchema ||
    manifest.approvalState !== "APPROVED_B_ONE_SHOT" ||
    manifest.scope !== R6_ONE_SHOT.scope ||
    manifest.sourceRepository !== R6_ONE_SHOT.sourceRepository ||
    manifest.sourceSha !== pins?.sourceSha || manifest.controlSha !== pins?.controlSha ||
    manifest.runCount !== 1 || manifest.maxAutomaticRetries !== 0 ||
    manifest.maxBlsRequests !== 18 || manifest.maxDolRequests !== 2 ||
    manifest.maxTotalRequests !== 20 || manifest.blsUnregistered24hLimit !== 25 ||
    manifest.allowProviderCalls !== true || manifest.allowLocalRawDbWrites !== true ||
    manifest.allowD1Writes !== false || manifest.allowSchedulerChanges !== false ||
    manifest.allowCoreSourceChanges !== false)
    stop("APPROVAL_SCOPE_STOP");
  return true;
}

// Verify the exact approved bytes before trusting parsed manifest fields.
// `pins` must come from a reviewed immutable workflow, never the issue body.
export function verifyR6OneShotApprovalBytes(bytes, pins) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 ||
    !hex(pins?.approvalManifestSha256, 64)) stop("APPROVAL_BYTES_INVALID");
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== pins.approvalManifestSha256) stop("APPROVAL_HASH_STOP");
  let manifest;
  try { manifest = JSON.parse(Buffer.from(bytes).toString("utf8")); }
  catch { stop("APPROVAL_JSON_STOP"); }
  validateR6OneShotApproval(manifest, pins);
  return manifest;
}

export function plannedR6BackfillCost(dueGroups) {
  if (!Array.isArray(dueGroups) || dueGroups.length > 6 ||
    new Set(dueGroups).size !== dueGroups.length ||
    !dueGroups.every(group => Object.hasOwn(R6_ONE_SHOT.groups, group)))
    stop("GROUP_SCOPE_STOP");
  const bls = dueGroups.reduce((v, group) => v + R6_ONE_SHOT.groups[group], 0);
  const dol = dueGroups.includes("DOL_UI_WEEKLY_CLAIMS") ? 2 : 0;
  if (bls > R6_ONE_SHOT.maxBlsRequests || dol > R6_ONE_SHOT.maxDolRequests ||
    bls + dol > R6_ONE_SHOT.maxTotalRequests)
    stop("REQUEST_BOUND_STOP");
  return { bls, dol, total: bls + dol };
}
