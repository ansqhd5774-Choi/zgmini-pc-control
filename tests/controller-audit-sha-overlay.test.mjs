import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const BASE='cde1dd372210e4658ae348cb9e2577967cb11634';
const TARGET='f03febc06f32a553676622ecf049e7dd90e2b7d5';
const PATH='controller/operations.mjs';
const BEFORE='0507663515206b97bb2cad72a2b3fb19032d5ab0f3c2bdd1305eaa6d225d5375';
const AFTER='6c0441108c244d1d5dd58e7793b785a371169a9d96b69e606200d905e8f59966';
const FROM='report.actualExecutionSha===host?.controllerSourceSha';
const TO="report.actualExecutionSha==='555f95708984580cd7d5a0fd05a80b718e867710'";
const git=(...args)=>execFileSync('git',args,{windowsHide:true,timeout:15000,maxBuffer:2e6});
const digest=x=>createHash('sha256').update(x).digest('hex');

test('historical ledger SHA repair is an exact one-file child of installed Controller',()=>{
 assert.equal(git('rev-list','--parents','-n','1',TARGET).toString().trim(),TARGET+' '+BASE);
 assert.equal(git('diff','--name-only',BASE,TARGET,'--').toString().trim(),PATH);
 const old=git('show',BASE+':'+PATH);
 const newer=git('show',TARGET+':'+PATH);
 assert.equal(digest(old),BEFORE);
 assert.equal(digest(newer),AFTER);
 const original=old.toString('utf8'),updated=newer.toString('utf8');
 assert.equal(original.split(FROM).length-1,1);
 assert.equal(updated,original.replace(FROM,TO));
 assert.match(updated,/supervisor\.sourceSha===host\?\.controllerSourceSha/);
 assert.equal(git('show',BASE+':config/operations.json').equals(
  git('show',TARGET+':config/operations.json')),true);
 const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
  input:updated,encoding:'utf8',windowsHide:true,timeout:15000
 });
 assert.equal(syntax.status,0,syntax.stderr);
});

test('historical SHA is fixed while current supervisor SHA stays independently protected',()=>{
 const original=git('show',BASE+':'+PATH).toString('utf8');
 const updated=git('show',TARGET+':'+PATH).toString('utf8');
 assert.equal(updated.includes(FROM),false);
 assert.equal(updated.split(TO).length-1,1);
 assert.equal(updated.includes('supervisor?.sourceSha===host?.controllerSourceSha'),true);
 assert.equal(updated.includes('report.requestId===requestId'),true);
 assert.equal(updated.includes('report.jobId===jobId'),true);
 assert.equal(updated.includes('report.status===\'PASS\''),true);
 assert.equal(original.includes('supervisor?.sourceSha===host?.controllerSourceSha'),true);
});
