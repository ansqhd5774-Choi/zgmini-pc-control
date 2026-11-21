import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

export const GROUPS = ['core','w01','w03','w05','watchdog'];
export function classifyPath(p) {
  if (p === '.github/workflows/controller-maintenance-source-tests.yml' ||
      p === 'tools/controller-ci-scope.mjs' ||
      p === 'tests/controller-ci-scope.test.mjs' ||
      p.startsWith('controller/') || p === 'config/operations.json' ||
      p === 'tools/update.mjs' || p.startsWith('tools/maintenance-')) return GROUPS;
  if (/^(tools|tests)\/(r181-|w03-)/.test(p) || p.startsWith('approvals/w03-')) return ['w03'];
  if (/^inflation-(manual|census)-b\//.test(p) || p.startsWith('writer-b/w01-') ||
      p.startsWith('approvals/inflation-') || p.startsWith('tests/w01-')) return ['w01'];
  if (p.startsWith('watchdog-b/') || p.startsWith('approvals/watchdog-') ||
      /^tests\/(runner-watchdog|watchdog-)/.test(p) ||
      p === 'tools/runner-watchdog.mjs' || p.includes('pc-watchdog-')) return ['core','watchdog'];
  if (p === 'tests/http32-two-host-checkpoints-readonly.test.mjs') return ['w01'];
  if (/^(tools|tests)\/earnings-/.test(p) ||
      /^tests\/(source-inventory-runtime-readonly|sqlite-readonly-contract|employment-r6-collection-evidence-readonly)\.test\.mjs$/.test(p)) return ['w05'];
  if (p.startsWith('shared-resource/') || p.startsWith('tests/shared-resource-') ||
      p.startsWith('tests/maintenance-') || p.startsWith('tests/controller-') ||
      /^tests\/(pc-source-readonly|provider-activity-runtime-readonly|http32-two-host-checkpoints-readonly|retired-iran-controller|writer-install-preimage-readonly|engine|core-task-observation|supervisor-status-write|source-bundle-register)\.test\.mjs$/.test(p) ||
      p.startsWith('tools/')) return ['core'];
  return GROUPS; // Unclassified changed paths must never silently skip tests.
}
export function selectGroups(files) {
  if (!files.length) return GROUPS;
  const selected = new Set();
  for (const path of files) for (const group of classifyPath(path)) selected.add(group);
  return [...selected];
}
if (process.argv[1]?.replaceAll('\\','/').endsWith('/controller-ci-scope.mjs')) {
  const base = process.env.PR_BASE_SHA, head = process.env.PR_HEAD_SHA;
  if (!/^[a-f0-9]{40}$/.test(base || '') || !/^[a-f0-9]{40}$/.test(head || '') ||
      !process.env.GITHUB_OUTPUT) throw Error('CI_SCOPE_INPUT_INVALID');
  const diff = execFileSync('git', ['diff','--name-only','-z','--diff-filter=ACDMRT',base,head],
    {maxBuffer:4*1024*1024});
  const selected = selectGroups(diff.toString('utf8').split('\0').filter(Boolean));
  for (const group of GROUPS) appendFileSync(process.env.GITHUB_OUTPUT,
    group + '=' + String(selected.includes(group)) + '\n');
  console.log('CI families=' + selected.join(','));
}
