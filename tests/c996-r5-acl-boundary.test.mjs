import test from 'node:test';
import assert from 'node:assert/strict';
import {ACL_IDS,parseAclBoundary,probeFixedAclBoundary}
 from '../c996-r5-readonly/acl-boundary.mjs';
import {fixedAclTargets} from '../c996-r5-readonly/collector.mjs';

const p=Object.freeze({
 ownerProfile:'C:\\Users\\ansqh',
 ownerTemp:'C:\\Users\\ansqh\\AppData\\Local\\Temp',
 r5Root:'C:\\Users\\ansqh\\AppData\\Local\\Temp\\C996_ISO_R5_80f18cafcbd44c82af95082138eb51e7',
 attempt:'C:\\Users\\ansqh\\AppData\\Local\\Temp\\C996_ISO_R5_80f18cafcbd44c82af95082138eb51e7\\ISO_ATTEMPT_187cd12b4d2a4789b9ef549ba9cda886',
});
const result=()=>({schema:'C996_R5_ACL_BOUNDARY_V1',runnerUserMatchesFixedOwner:false,
 entries:ACL_IDS.map((id,i)=>({id,status:i===0?'ACL_READABLE':'ACCESS_DENIED'}))});
test('fixed Windows paths and scoped read-only ACL query only',()=>{
 let calls=0;
 const spawn=(exe,args,options)=>{
  calls++;
  const script=Buffer.from(args.at(-1),'base64').toString('utf16le');
  assert.match(exe,/powershell\.exe$/);
  assert.deepEqual(args.slice(0,3),['-NoProfile','-NonInteractive','-EncodedCommand']);
  assert.ok(script.includes('Get-Acl -LiteralPath'));
  assert.ok(!/Set-Acl|Set-ItemProperty|takeown|icacls|Add-Local|Grant|Invoke-Expression|Start-Process/i.test(script));
  assert.equal(options.shell,false);
  assert.equal(options.stdio[2],'ignore');
  return {status:0,stdout:JSON.stringify(result())};
 };
 const observed=probeFixedAclBoundary({...p,platform:'win32',spawn});
 assert.equal(calls,1);
 assert.equal(observed.status,'SCOPED_ACL_OBSERVED');
 assert.equal(observed.runnerUserMatchesFixedOwner,false);
 assert.equal(observed.entries[3].status,'ACCESS_DENIED');
});
test('reject path escape and unapproved scope before invoking ACL probe',()=>{
 let calls=0;
 const spawn=()=>{calls++;throw Error('must not spawn')};
 for(const bad of [
  {...p,ownerProfile:'C:\\Users\\another'},
  {...p,ownerTemp:'E:\\other'},
  {...p,r5Root:'C:\\Users\\ansqh\\Outside'},
  {...p,attempt:'C:\\Users\\ansqh\\AppData\\Local\\Temp\\Other'},
 ])assert.equal(probeFixedAclBoundary({...bad,platform:'win32',spawn}).status,'FIXED_PATHS_INVALID');
 assert.equal(calls,0);
});
test('reject malformed ACL status, identity and arbitrary raw descriptor keys',()=>{
 for(const mutate of [
  x=>x.runnerUserMatchesFixedOwner='secret',
  x=>x.entries[1].status='DACL_LEAKED',
  x=>x.entries[0].id='E:\\secret',
  x=>x.entries.push({id:'UNBOUNDED',status:'ACL_READABLE'})
 ]){
  const x=result();mutate(x);assert.equal(parseAclBoundary(JSON.stringify(x)),null);
 }
 const got=parseAclBoundary(JSON.stringify({...result(),secret:'private-security-descriptor'}));
 assert.ok(got);
 assert.ok(!JSON.stringify(got).includes('private-security-descriptor'));
});
test('ACL query denial and unavailable PowerShell are failures, not permission grants',()=>{
 const res=probeFixedAclBoundary({...p,platform:'win32',spawn:()=>({
  status:1,stdout:'ACCESS DENIED: private path'})});
 assert.equal(res.status,'ACL_QUERY_UNAVAILABLE');
 assert.equal(probeFixedAclBoundary({...p,platform:'linux'}).status,'NOT_WINDOWS');
});

test('actual C996 collector ACL targets exactly match immutable probe scope',()=>{
 const actual=fixedAclTargets();
 assert.deepEqual(actual,p);
 let called=false;
 const fake=()=>{called=true;return {status:0,stdout:JSON.stringify(result())}};
 const observed=probeFixedAclBoundary({...actual,platform:'win32',spawn:fake});
 assert.equal(called,true);
 assert.equal(observed.status,'SCOPED_ACL_OBSERVED');
});
