import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createIsolatedOrphanStatusWriter}
 from '../tools/supervisor-orphan-status-temp-writer.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const raw=x=>Buffer.from(JSON.stringify(x)+'\n');
const six=()=>Array.from({length:6},(_,i)=>({
 seat:i+1,pid:5101+i,alive:true
}));
const next=()=>({
 at:'2026-11-27T00:15:00.000Z',pid:9000,
 sourceSha:'a'.repeat(40),mode:'LISTENING',
 adoptionMode:'ADOPT_EXISTING_SIX_NO_SPAWN',children:six(),
 restartCounts:{}
});
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-orphan-fixture-'));
 const control=path.join(root,'pc-control');
 fs.mkdirSync(path.join(control,'leases','supervisor'),{recursive:true});
 const file=path.join(control,'SUPERVISOR_STATUS.json');
 const original=raw({at:'2026-11-27T00:00:00Z',pid:8080,
  sourceSha:'a'.repeat(40),mode:'LISTENING',children:six()});
 fs.writeFileSync(file,original,{flag:'wx'});
 return {root,control,file,original,
  cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
const packet=(fx,body=next())=>{
 const bytes=raw(body);
 return Object.freeze({
  schema:'ZGMINI_ORPHAN_EXACT_HEARTBEAT_CAS_WRITE_V1',
  fixedFile:'SUPERVISOR_STATUS.json',
  expectedRawSha256:hash(fs.readFileSync(fx.file)),
  nextRawSha256:hash(bytes),nextRawBytes:bytes,canCommit:()=>true
 });
};

test('fixed OS TEMP path performs exact staged status CAS and truthful raw readback',async()=>{
 const fx=fixture();
 try{
  const writer=createIsolatedOrphanStatusWriter({root:fx.root});
  const p=packet(fx);
  const x=await writer(p);
  assert.equal(x.status,'EXACT_RAW_CAS_READBACK_VERIFIED');
  assert.equal(x.expectedRawSha256,p.expectedRawSha256);
  assert.equal(x.readbackRawSha256,p.nextRawSha256);
  assert.equal(x.operatingEffectAuthorized,false);
  assert.equal(x.operatingWrites,0);
  assert.equal(x.runnerStarts,0);
  assert.equal(x.runnerStops,0);
  assert.equal(x.leaseMutationAuthorized,false);
  assert.equal(fs.readFileSync(fx.file,'utf8'),p.nextRawBytes.toString());
  assert.equal(fs.existsSync(path.join(fx.control,'orphan-status-cas-lock')),false);
  assert.equal(fs.readdirSync(fx.control).filter(x=>x.endsWith('.tmp')).length,0);
  assert.doesNotMatch(JSON.stringify(x),/5101|9000|SUPERVISOR_NONCE|E:\\/);
 }finally{fx.cleanup();}
});

test('same approved old status hash cannot replay after a successful self-write',async()=>{
 const fx=fixture();
 try{
  const writer=createIsolatedOrphanStatusWriter({root:fx.root});
  const old=packet(fx);
  assert.equal((await writer(old)).status,'EXACT_RAW_CAS_READBACK_VERIFIED');
  assert.equal((await writer(old)).code,'ORPHAN_STATUS_TEMP_INITIAL_CAS_CHANGED');
  const newPacket=packet(fx,{...next(),at:'2026-11-27T00:15:15.000Z'});
  assert.equal((await writer(newPacket)).status,'EXACT_RAW_CAS_READBACK_VERIFIED');
  assert.equal(fs.readFileSync(fx.file,'utf8'),newPacket.nextRawBytes.toString());
 }finally{fx.cleanup();}
});

test('untrusted root and operating-PC root can never enter isolated status writer',async()=>{
 const fx=fixture();
 try{
  for(const root of [
   'E:/ZGmini/automation/pc-control',
   os.tmpdir(),fx.control,path.dirname(fx.root)
  ]){
   const writer=createIsolatedOrphanStatusWriter({root});
   const out=await writer(packet(fx));
   assert.equal(out.status,'BLOCKED');
   assert.equal(out.code,'ORPHAN_STATUS_TEMP_SCOPE_DENIED');
  }
  assert.deepEqual(fs.readFileSync(fx.file),fx.original);
 }finally{fx.cleanup();}
});

test('malformed next content, path alias, forged sha or extra confidential key never writes',async()=>{
 const fx=fixture();
 try{
  const writer=createIsolatedOrphanStatusWriter({root:fx.root});
  const mutations=[
   p=>({...p,fixedFile:'../host.json'}),
   p=>({...p,nextRawSha256:'f'.repeat(64)}),
   p=>({...p,expectedRawSha256:'b'.repeat(64)}),
   p=>({...p,nextRawBytes:raw({...next(),nonce:'PRIVATE_NONCE'})}),
   p=>({...p,nextRawBytes:raw({...next(),children:six().slice(1)})}),
   p=>({...p,nextRawBytes:raw({...next(),children:six().map((q,i)=>i===4?{...q,pid:5101}:q)})}),
   p=>({...p,canCommit:()=>false}),
   p=>({...p,schema:'SOME_OTHER_SCHEME'})
  ];
  for(const mutate of mutations){
   const x=await writer(mutate(packet(fx)));
   assert.equal(x.status,'BLOCKED');
   assert.deepEqual(fs.readFileSync(fx.file),fx.original);
  }
 }finally{fx.cleanup();}
});

test('cooperating writer lock is not stolen and never automatically cleared',async()=>{
 const fx=fixture();
 try{
  const lock=path.join(fx.control,'orphan-status-cas-lock');
  fs.mkdirSync(lock);
  const x=await createIsolatedOrphanStatusWriter({root:fx.root})(packet(fx));
  assert.equal(x.status,'BLOCKED');
  assert.equal(x.code,'ORPHAN_STATUS_TEMP_LOCK_BUSY');
  assert.equal(fs.existsSync(lock),true);
  assert.deepEqual(fs.readFileSync(fx.file),fx.original);
 }finally{fx.cleanup();}
});

test('stop fence withdrawn during staging aborts before replace, cleans owned lock',async()=>{
 const fx=fixture();
 try{
  let permit=true;
  const writer=createIsolatedOrphanStatusWriter({
   root:fx.root,beforeCommit:()=>{permit=false;}
  });
  const x=await writer({...packet(fx),canCommit:()=>permit});
  assert.equal(x.status,'BLOCKED');
  assert.equal(x.code,'ORPHAN_STATUS_TEMP_PRECOMMIT_CAS_CHANGED');
  assert.deepEqual(fs.readFileSync(fx.file),fx.original);
  assert.equal(fs.existsSync(path.join(fx.control,'orphan-status-cas-lock')),false);
 }finally{fx.cleanup();}
});

test('external status drift before rename is not overwritten by TEMP writer',async()=>{
 const fx=fixture();
 try{
  const external=raw({at:'2026-11-27T00:20:00Z',pid:7777,
   sourceSha:'a'.repeat(40),mode:'LISTENING',children:six()});
  const writer=createIsolatedOrphanStatusWriter({
   root:fx.root,beforeCommit:()=>{fs.writeFileSync(fx.file,external);}
  });
  const x=await writer(packet(fx));
  assert.equal(x.status,'BLOCKED');
  assert.equal(x.code,'ORPHAN_STATUS_TEMP_PRECOMMIT_CAS_CHANGED');
  assert.deepEqual(fs.readFileSync(fx.file),external);
  assert.equal(fs.existsSync(path.join(fx.control,'orphan-status-cas-lock')),false);
 }finally{fx.cleanup();}
});

test('external post-rename tamper is RECOVERY_REQUIRED, retains lock and no auto-rollback',async()=>{
 const fx=fixture();
 try{
  const external=raw({at:'2026-11-27T00:25:00Z',pid:8000,
   sourceSha:'a'.repeat(40),mode:'LISTENING',children:six()});
  const filesystem=Object.create(fs);
  filesystem.renameSync=(from,to)=>{
   fs.renameSync(from,to);
   if(to===fx.file)fs.writeFileSync(to,external);
  };
  const x=await createIsolatedOrphanStatusWriter({
   root:fx.root,filesystem
  })(packet(fx));
  assert.equal(x.status,'RECOVERY_REQUIRED');
  assert.equal(x.code,'ORPHAN_STATUS_TEMP_POSTREPLACE_UNVERIFIED');
  assert.deepEqual(fs.readFileSync(fx.file),external);
  assert.equal(fs.existsSync(path.join(fx.control,'orphan-status-cas-lock')),true);
  assert.equal(x.operatingEffectAuthorized,false);
 }finally{fx.cleanup();}
});

test('same-hash status symlink or hardlink never becomes writable target',async()=>{
 for(const kind of ['hardlink','symlink']){
  const fx=fixture();
  try{
   const outside=path.join(fx.root,'status-backup.json');
   fs.renameSync(fx.file,outside);
   try{
    if(kind==='hardlink')fs.linkSync(outside,fx.file);
    else fs.symlinkSync(outside,fx.file);
   }catch(e){
    if(kind==='symlink'&&['EPERM','EACCES','ENOSYS'].includes(e.code))continue;
    throw e;
   }
   const x=await createIsolatedOrphanStatusWriter({root:fx.root})(packet({
    ...fx,file:outside
   }));
   assert.equal(x.status,'BLOCKED');
   assert.deepEqual(fs.readFileSync(outside),fx.original);
  }finally{fx.cleanup();}
 }
});

test('status TEMP writer source never uses Runner launch, process kill or operating root',()=>{
 const source=fs.readFileSync(new URL('../tools/supervisor-orphan-status-temp-writer.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/process\.kill|taskkill|Stop-Process|spawn\(|execFileSync|Get-CimInstance|E:\/ZGmini/);
 assert.match(source,/assertIsolatedOrphanRoot/);
 assert.match(source,/fsyncSync/);
 assert.match(source,/ORPHAN_STATUS_TEMP_POSTREPLACE_UNVERIFIED/);
 assert.doesNotMatch(source,/console\.log|process\.stdout\.write|process\.env/);
});
