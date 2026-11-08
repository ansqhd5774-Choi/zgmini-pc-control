import {parseHandoff, routeHandoff, fingerprintHandoff} from './contract.mjs';

// Deterministic, side-effect-free intake. A GitHub issue is a durable record,
// not a command to execute arbitrary code on a Windows host.
export function prepareHandoff(body, existingBodies = [], options = {}) {
  const request = parseHandoff(body);
  const fingerprint = fingerprintHandoff(request);
  for (const candidate of existingBodies) {
    let previous;
    try { previous = parseHandoff(candidate); } catch { continue; }
    if (fingerprintHandoff(previous) === fingerprint) return Object.freeze({
      state: 'DUPLICATE_REUSED', fingerprint, originIssueNumber: request.origin.issueNumber,
      existingIncidentId: previous.incidentId, newDispatches: 0
    });
  }
  const route = routeHandoff(request, options);
  return Object.freeze({state: route.state, fingerprint: route.fingerprint, role: route.role,
    originIssueNumber: request.origin.issueNumber, incidentId: request.incidentId,
    checkpoint: request.origin.checkpoint, automaticPcRetries: route.automaticPcRetries,
    agentDispatchLimit: route.agentDispatchLimit, operationalWrites: 0});
}
