// ZGMINI independent support: isolated fault-injection fixture only.
// NOT the approved handoff-maintenance.mjs, NOT a Windows/operator test.
// Models the order at tools/handoff-maintenance.mjs@c2e6744 lines 320-336.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function isolatedFixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-support-prejournal-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'runtime'),{recursive:true});
  for(let i=0;i<7;i++)fs.writeFileSync(path.join(root,'runtime',`file-${i}.mjs`),`baseline-${i}\n`);
  fs.writeFileSync(path.join(root,'MAINTENANCE_INSTALL.json'),'{\"sourceSha\":\"baseline\"}\n');
  fs.writeFileSync(path.join(root,'Startup.vbs'),'startup baseline\n');
  return root;
}
// Fixture adapts the SOURCE CONTROL-FLOW ORDER, not the production function.
function modelPreJournal(root, failAt) {
  const state={receiverAlive:true,stopAccepted:false,installedBytesChanged:false};
  const request=path.join(root,'STOP_REQUEST.json');
  const backup=path.join(root,'backup');
  const journal=path.join(root,'handoff-target.json');
  fs.writeFileSync(request,'{\"action\":\"stop\"}\n',{flag:'wx'});
  if(failAt==='timeout')throw Object.assign(Error('SIMULATED_TIMEOUT'),{state});
  state.receiverAlive=false;
  state.stopAccepted=true;
  if(failAt==='mkdir')throw Object.assign(Error('SIMULATED_BACKUP_MKDIR_EACCES'),{state});
  fs.mkdirSync(backup,{recursive:true});
  for(let i=0;i<7;i++) {
    const source=path.join(root,'runtime',`file-${i}.mjs`);
    const dest=path.join(backup,`file-${i}.mjs`);
    if(failAt==='snapshot'&&i===3)throw Object.assign(Error('SIMULATED_SNAPSHOT_ENOSPC'),{state});
    fs.copyFileSync(source,dest,fs.constants.COPYFILE_EXCL);
  }
  if(failAt==='startup')throw Object.assign(Error('SIMULATED_STARTUP_SNAPSHOT_EACCES'),{state});
  fs.copyFileSync(path.join(root,'Startup.vbs'),path.join(backup,'startup.vbs'),fs.constants.COPYFILE_EXCL);
  if(failAt==='journal')throw Object.assign(Error('SIMULATED_JOURNAL_EACCES'),{state});
  fs.writeFileSync(journal,JSON.stringify({status:'RUNNING'}));
  return state;
}
for(const failAt of ['timeout','mkdir','snapshot','startup','journal']){
  test(`fixture ${failAt}: post-stop failure boundary does not provide durable journal`,t=>{
    const root=isolatedFixture(t);
    let error;
    try{modelPreJournal(root,failAt);}catch(e){error=e;}
    assert.ok(error, 'injected fault must occur');
    assert.equal(fs.existsSync(path.join(root,'handoff-target.json')),false);
    assert.equal(fs.existsSync(path.join(root,'STOP_REQUEST.json')),true);
    assert.equal(error.state.installedBytesChanged,false);
    if(failAt!=='timeout')assert.equal(error.state.receiverAlive,false);
    if(failAt==='snapshot')assert.equal(fs.existsSync(path.join(root,'backup','file-2.mjs')),true);
  });
}
test('no fault: source-order fixture can reach a journal',t=>{
  const root=isolatedFixture(t);
  const state=modelPreJournal(root,null);
  assert.equal(state.receiverAlive,false);
  assert.equal(fs.existsSync(path.join(root,'handoff-target.json')),true);
});
