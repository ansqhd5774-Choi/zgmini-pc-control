// Public repositories may run source-only checks on GitHub-hosted runners.
// This is NOT an authorization for a self-hosted Runner, Controller, Writer or B effect.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const REPO_ID = 1442936296;
const OWNER = 'ansqhd5774-Choi';
const OWNER_ID = 327938088;
const SHA = /^[a-f0-9]{40}$/;
const ACTIONS = new Set(['opened','synchronize','reopened']);

const blocked = code => ({status:'BLOCKED', code, sourceOnly:true,
  operationalWrites:0, executionAuthorized:false, selfHostedAuthorized:false,
  controllerBAuthorized:false});

/** Check untrusted webhook metadata; no secret, shell, operating path or GitHub API access. */
export function assessPublicSourceCi({event, env} = {}) {
  if (!env || env.GITHUB_EVENT_NAME !== 'pull_request' ||
      env.GITHUB_REPOSITORY !== REPO ||
      env.RUNNER_ENVIRONMENT !== 'github-hosted' ||
      !SHA.test(env.GITHUB_SHA ?? '')) {
    return blocked('PUBLIC_CI_HOST_OR_EVENT_UNTRUSTED');
  }
  const r=event?.repository, pr=event?.pull_request;
  if (!r || r.id !== REPO_ID || r.full_name !== REPO || r.private !== false ||
      r.visibility !== 'public' || r.owner?.id !== OWNER_ID ||
      r.owner?.login !== OWNER) {
    return blocked('PUBLIC_CI_REPOSITORY_MISMATCH');
  }
  if (!ACTIONS.has(event?.action) || !pr ||
      pr.user?.id !== OWNER_ID || pr.user?.login !== OWNER ||
      pr.base?.repo?.id !== REPO_ID || pr.base?.repo?.full_name !== REPO ||
      pr.base?.ref !== 'main' || !SHA.test(pr.base?.sha ?? '') ||
      pr.head?.repo?.id !== REPO_ID || pr.head?.repo?.full_name !== REPO ||
      !SHA.test(pr.head?.sha ?? '') ||
      pr.head?.sha === pr.base?.sha || pr.number !== event?.number ||
      !Number.isSafeInteger(pr.number) || pr.number <= 0) {
    return blocked('PUBLIC_CI_PR_ORIGIN_UNTRUSTED');
  }
  return {status:'PASS',code:'PUBLIC_SOURCE_CI_ONLY',sourceOnly:true,
    operationalWrites:0, executionAuthorized:false,selfHostedAuthorized:false,
    controllerBAuthorized:false};
}

export function runPublicSourceCiGuard(env=process.env) {
  let event;
  try {
    if (typeof env.GITHUB_EVENT_PATH !== 'string' || !env.GITHUB_EVENT_PATH) {
      return blocked('PUBLIC_CI_EVENT_FILE_UNAVAILABLE');
    }
    const stat=fs.statSync(env.GITHUB_EVENT_PATH);
    if (!stat.isFile() || stat.size < 2 || stat.size > 2_000_000) {
      return blocked('PUBLIC_CI_EVENT_FILE_INVALID');
    }
    event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  } catch { return blocked('PUBLIC_CI_EVENT_FILE_INVALID'); }
  return assessPublicSourceCi({event,env});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result=runPublicSourceCiGuard();
  process.stdout.write(JSON.stringify(result)+'\n');
  if (result.status !== 'PASS') process.exitCode=1;
}
