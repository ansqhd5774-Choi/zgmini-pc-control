import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const BASE='555f95708984580cd7d5a0fd05a80b718e867710';
const TARGET='cde1dd372210e4658ae348cb9e2577967cb11634';
const TESTED_MAIN='89430d68db34716c355f60126a0ed6c1f0753c84';
const BRANCH='refs/remotes/origin/codex/controller-operating-audit-selective-one-20261128';
const FILES=['config/operations.json','controller/operations.mjs'];
const DIGESTS={
 'config/operations.json':'177cb15b40ca34fc415a091bf93f8f6ac6d607ce4d6f7f429a77d73c8abdcccf',
 'controller/operations.mjs':'0507663515206b97bb2cad72a2b3fb19032d5ab0f3c2bdd1305eaa6d225d5375'
};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:2e6}).trim();
const bytes=(sha,p)=>execFileSync('git',['show',sha+':'+p],{windowsHide:true,timeout:10000,maxBuffer:2e6});
const sha256=b=>createHash('sha256').update(b).digest('hex');

test('selective public A audit candidate is exact two-file child of installed immutable source',()=>{
 assert.equal(git('rev-parse',BRANCH),TARGET);
 assert.equal(git('cat-file','-t',TARGET),'commit');
 assert.deepEqual(git('rev-list','--parents','-n','1',TARGET).split(' '),[TARGET,BASE]);
 assert.deepEqual(git('diff','--name-only',BASE,TARGET,'--').split(/\r?\n/).sort(),FILES);
 for(const p of FILES)assert.equal(sha256(bytes(TARGET,p)),DIGESTS[p],p);
 assert.equal(sha256(bytes(BASE,'controller/common.mjs')),
  '9e940a92c0f3ac332ba4d8a5d52b4bac0d647340bdb30863e2628b5b70d27083');
 assert.deepEqual(bytes(TARGET,'controller/common.mjs'),bytes(BASE,'controller/common.mjs'));
});
test('selective candidate preserves all existing A operations and matches tested main helper',()=>{
 const old=bytes(BASE,'controller/operations.mjs').toString('utf8');
 const next=bytes(TARGET,'controller/operations.mjs').toString('utf8');
 const main=bytes(TESTED_MAIN,'controller/operations.mjs').toString('utf8');
 const marker='// Fixed Public A candidate: read-only, bounded, no dynamic paths or private output.';
 const anchor="const activeTasks=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'];";
 const handler=" if(request.operation==='controller-operating-audit-readonly')return inspectControllerOperatingAuditReadonly();\n";
 const helper=x=>{const a=x.indexOf(marker),b=x.indexOf(anchor);assert.ok(a>=0&&b>a);return x.slice(a,b);};
 assert.equal(helper(next),helper(main));
 assert.equal(next.replace(helper(next),'').replace(handler,''),old);
 const previous=JSON.parse(bytes(BASE,'config/operations.json'));
 const proposed=JSON.parse(bytes(TARGET,'config/operations.json'));
 assert.deepEqual(proposed.operations['controller-operating-audit-readonly'],
  {grade:'A',timeoutSeconds:60,resource:'light'});
 delete proposed.operations['controller-operating-audit-readonly'];
 assert.deepEqual(proposed,previous);
 const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
  input:next,encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(syntax.status,0,syntax.stderr);
});
