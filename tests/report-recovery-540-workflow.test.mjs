import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RECOVERY,validateTrigger} from '../controller/report-recovery-540-once.mjs';

test('072 exact #540 report recovery is delivered and the owner-only intake retired',()=>{
 assert.equal(fs.existsSync(new URL('../.github/workflows/pc-report-recovery-540-once.yml',import.meta.url)),false);
 assert.equal(RECOVERY.issueNumber,540);
 assert.equal(RECOVERY.runId,'42261956750');
 assert.equal(RECOVERY.operation,'release-calendar-runtime-readonly');
 assert.equal(RECOVERY.trigger,'/zgmini-recover-540-once');
 assert.throws(()=>validateTrigger({},{GITHUB_REPOSITORY:RECOVERY.repository}),/RECOVERY_EVENT_DENIED/);
});
