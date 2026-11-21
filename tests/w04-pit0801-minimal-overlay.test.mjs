import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {validateControllerImportClosure} from '../tools/maintenance-contract.mjs';

const installed='5e805bc907a4fb9e8d2fb2d53432bfec7b7cea59';
const target='f20004d4b784db1cc5e823bb3cde7b925aadcab3';
const filename='controller/operations.mjs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trimEnd();
const show=(sha,p)=>git('show',sha+':'+p);
const r6Part=source=>{
 const start=source.indexOf('function r6LocalResultReadback(');
 const end=source.indexOf('export function readCore(');
 assert.ok(start>=0&&end>start,'R6 function boundary required');
 return source.slice(start,end);
};

test('W04 model-only selective target is exactly one commit and one file',()=>{
 assert.equal(git('rev-list','--parents','-n','1',target),target+' '+installed);
 assert.deepEqual(git('diff','--name-only',installed,target).split(/\r?\n/),[filename]);
});

test('all non-R6 operations source remains byte-identical to verified installed base',()=>{
 const before=show(installed,filename),after=show(target,filename);
 const prior=r6Part(before),next=r6Part(after);
 assert.equal(before.replace(prior,''),after.replace(next,''));
 assert.match(next,/MODEL_PROVENANCE_INVALID/);
 assert.match(next,/methodologyVersion:body\.methodologyVersion/);
 assert.match(next,/formulaHash:body\.formulaHash/);
 assert.match(next,/projected\.localResultReadback=/);
 assert.match(next,/projected\.methodologyVersion=/);
 assert.match(next,/projected\.formulaHash=/);
});

test('full recursive module imports resolve in immutable target Controller tree',()=>{
 const files=git('ls-tree','-r','--name-only',target,'--','controller','config').split(/\r?\n/);
 const result=validateControllerImportClosure(files,[filename],rel=>show(target,rel));
 assert.equal(result.status,'VERIFIED');
 assert.ok(result.checkedModules>=20);
 assert.doesNotMatch(show(target,filename),/from ['"]\.\/(?:r54-runtime-binding-readonly|inflation-causal-saved-readonly|earnings-bea-mfg-archive-readonly)\.mjs['"]/);
});
