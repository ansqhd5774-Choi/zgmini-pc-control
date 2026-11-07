// SOURCE-ONLY seam for an authorized future common Writer B receiver.
// NO entrypoint, CLI, Issue listener, approved operation or PC installation.
// The source-only Writer-B operation does NOT grant host/registry PIN effects.
// Activation requires a separately approved, installed runtime operation.
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
 from '../../r17-writer-b/r17-b-claim.mjs';
import {makeWindowsRegistryPinBAdapter}
 from './windows-registry-pin-adapter.mjs';

// Reuse the exact existing Writer B mutex/journal implementation. The target
// paths and authority must come from the attested *installed* receiver, never
// a GitHub Issue, CLI argument or a content-specific job.
const existingSharedWriterB=Object.freeze({
 acquireInstallLock,createInstallJournal,releaseInstallClaim,
});

/**
 * Minimal integration seam after the official receiver has:
 * 1. verified the owner/Issue event, immutable Git blob + raw approval SHA,
 * 2. checked its own installed source/runtime provenance and B effect scope,
 * 3. observed and pinned actual fixed host/registry/result locations,
 * 4. obtained the separately authorized narrow B operation.
 *
 * The caller must separately invoke the pure `runApprovedRegistryCas` state
 * machine. The factory alone never reads or writes a PC file.
 */
export function makeApprovedRegistryPinBFromWriterReceiver({
 authenticatedReceiver,targets,requestId,approvedRegistryAfterBytes,
 verifyApproval,
}={}){
 return makeWindowsRegistryPinBAdapter({authenticatedReceiver,targets,
  requestId,approvedRegistryAfterBytes,verifyApproval,
  lockApi:existingSharedWriterB});
}
