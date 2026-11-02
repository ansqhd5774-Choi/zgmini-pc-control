import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {attestReceiverOrigin} from '../tools/maintenance-agent.mjs';

const digest=x=>createHash('sha256').update(x).digest('hex');
const date='20261103160521.123456+540';
const ownerSid='S-1-5-21-100-200-300-1000';
const rootFixture=()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-maintenance-proof-'));
 const appData=path.join(root,'user','AppData','Roaming');
 const startup=path.join(appData,'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_MAINTENANCE.vbs');
 fs.mkdirSync(path.dirname(startup),{recursive:true});
 fs.mkdirSync(path.join(root,'tools'),{recursive:true});
 fs.writeFileSync(startup,'only the fixed signed startup content\r\n');
 fs.writeFileSync(path.join(root,'tools/maintenance-ancestry.vbs'),'signed checker');
 const sourceSha='c'.repeat(40);
 fs.writeFileSync(path.join(root,'MAINTENANCE_INSTALL.json'),JSON.stringify({
   schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',sourceSha,
   startupSha256:digest(fs.readFileSync(startup))}));
 const owner={pid:process.pid,nonce:randomUUID(),bootAt:Date.now()-os.uptime()*1000};
 return {root,appData,startup,owner};
};
const confirmed=()=>`ATTESTED|${date}|1|${ownerSid}\n`;

test('fixed Startup proof binds receiver lease nonce, PID, boot and WMI creation identity',()=>{
 const f=rootFixture();
 const result=attestReceiverOrigin(f.root,f.owner,{platform:'win32',appData:f.appData,cscript:args=>{
   assert.deepEqual(args.slice(0,2),['//NoLogo','//B']);
   assert.deepEqual(args.slice(3),['CAPTURE',String(process.pid)]);
   return confirmed();
 }});
 assert.equal(result.pid,process.pid);
 assert.equal(result.nonce,f.owner.nonce);
 assert.equal(result.created,date);
 assert.equal(result.sid,ownerSid);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.root,'receivers',f.owner.nonce+'.json'))),result);
});

test('no WMI witness never manufactures a positive origin proof',()=>{
 const f=rootFixture();
 assert.throws(()=>attestReceiverOrigin(f.root,f.owner,{platform:'win32',appData:f.appData,
   cscript:()=>{throw Error('WMI unavailable');}}),/MAINTENANCE_ORIGIN_UNKNOWN/);
 assert.equal(fs.existsSync(path.join(f.root,'receivers')),false);
});

test('changed Startup file fails before any WMI call',()=>{
 const f=rootFixture();fs.appendFileSync(f.startup,'tampered');
 assert.throws(()=>attestReceiverOrigin(f.root,f.owner,{platform:'win32',appData:f.appData,
   cscript:()=>{throw Error('must not call');}}),/MAINTENANCE_ORIGIN_UNKNOWN/);
});

test('stale owner PID and forged WMI return cannot bind to current receiver',()=>{
 const f=rootFixture();f.owner.pid++;
 assert.throws(()=>attestReceiverOrigin(f.root,f.owner,{platform:'win32',appData:f.appData,
   cscript:()=>confirmed()}),/MAINTENANCE_ORIGIN_UNKNOWN/);
});

test('simulated WMI process graph rejects orphan, PID reuse, Runner descendants and cycles',()=>{
 // This pure model is NOT a Windows integration test; it checks the intended
 // decision boundary and prevents tests from treating UNKNOWN as PASS.
 const classify=(graph,{updater,receiver,supervisor,created})=>{
  const visited=new Set();let pid=updater;
  for(let i=0;i<32;i++){
   if(pid===supervisor)return 'DESCENDANT';
   const child=graph[pid];if(!child||visited.has(pid))return 'UNKNOWN';
   visited.add(pid);
   if(pid===receiver)return child.created===created&&child.approved?'INDEPENDENT':'UNKNOWN';
   const parent=graph[child.parent];
   if(!parent||parent.created>child.created)return 'UNKNOWN';
   pid=child.parent;
  }
  return 'UNKNOWN';
 };
 const args={updater:13,receiver:11,supervisor:88,created:5};
 // Receiver's historical WScript (PID 9) is dead; it is beyond the trusted
 // receiver anchor and must not be queried during a post-attestation update.
 assert.equal(classify({13:{parent:11,created:9},11:{parent:9,created:5,approved:true}},args),'INDEPENDENT');
 // Equal timestamps are not evidence of PID reuse by themselves. The trusted
 // receiver identity/proof and the live fixed WScript anchor remain required.
 assert.equal(classify({13:{parent:11,created:5},11:{parent:9,created:5,approved:true}},args),'INDEPENDENT');
 assert.equal(classify({13:{parent:11,created:9},11:{parent:9,created:5,approved:false}},args),'UNKNOWN');
 assert.equal(classify({13:{parent:11,created:9},11:{parent:9,created:10,approved:true}},args),'UNKNOWN');
 // Parent PID reused 1 microsecond later, WITHIN the same second.
 assert.equal(classify({13:{parent:11,created:9.000001},11:{parent:9,created:9.000002,approved:true}},
   {...args,created:9.000002}),'UNKNOWN');
 assert.equal(classify({13:{parent:88,created:9},88:{parent:11,created:5,approved:true}},args),'DESCENDANT');
 assert.equal(classify({13:{parent:14,created:9},14:{parent:13,created:8}},args),'UNKNOWN');
 assert.equal(classify({13:{parent:12,created:9}},args),'UNKNOWN');
});

test('source statically requires positive attestation, timestamp and second stop-time verification',()=>{
 const update=fs.readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
 const checker=fs.readFileSync(new URL('../tools/maintenance-ancestry.vbs',import.meta.url),'utf8');
 const bootstrap=fs.readFileSync(new URL('../tools/bootstrap-maintenance.mjs',import.meta.url),'utf8');
 assert.match(update,/MAINTENANCE_ORIGIN_UNKNOWN/);
 assert.match(update,/proof\.nonce===owner\.nonce/);
 assert.match(update,/proof\.created/);
 assert.match(update,/verifyIndependent\(current\.owner\.pid\)/);
 assert.match(checker,/If bornParent="" Or Later\(bornParent,bornCurrent\) Then Unknown/);
 assert.match(checker,/Left\(parentBorn,21\)>Left\(childBorn,21\)/);
 assert.match(checker,/Right\(parentBorn,4\)<>Right\(childBorn,4\)/);
 assert.match(checker,/If ownPid=supervisorPid Then WScript\.Echo "DESCENDANT"/);
 assert.match(checker,/If Not explorerFound Then Unknown/);
 assert.match(bootstrap,/, 0, True/);
 assert.match(bootstrap,/explorer\.exe/);
 assert.match(bootstrap,/launchStartup\(plan\.startup\)/);
});
