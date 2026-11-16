import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectInflationEvent129Once,describeEvent129}
 from './inflation-event129-evidence-readonly.mjs';
import {APPROVED_VBS_CHAIN_FILES} from './inflation-vbs-b-proof.mjs';
const start=Date.parse('2026-11-15T14:00:00.000Z'),clock=()=>start+25000;
const event=(path='E:\\ZGmini\\runtime\\node.exe',pid=5000,opts={})=>
 '<Events><Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">'+
 '<System><Provider Name="Microsoft-Windows-TaskScheduler"/><EventID>129</EventID>'+
 '<TimeCreated SystemTime="'+(opts.time??'2026-11-15T14:00:00.000Z')+'"/>'+
 '<Channel>Microsoft-Windows-TaskScheduler/Operational</Channel></System>'+
 '<EventData><Data Name="TaskName">\\ZGMINI-PC-Local-Core</Data>'+
 '<Data Name="Path">'+path+'</Data><Data Name="ProcessID">'+pid+'</Data>'+
 '</EventData></Event></Events>';
const initial={ok:true,linked:false,taskRunning:true,ownerCoreMatched:true,
 ownerKoreaMatched:false,ownerCreatedAtMs:start+10000,taskVbsLinked:false,
 taskInstanceStatus:'EMPTY',wmiStatus:'OK',ownerFound:true,approvedLauncherKinds:[]};
const vbs={...initial,taskVbsLinked:true,taskVbsCreatedAtMs:start,
 approvedLauncherKinds:['ARCHIVE_NODE','CUTOVER_VBS','TASK_VBS']};
function fixture({xml=event(),owner=initial,witness=vbs,secondHash='SAME',
 failEvent=false,failTask=false,failWmi=false,lockAt=start+20000}={}){
 const seen=[],bytes=Buffer.isBuffer(xml)?xml:Buffer.from(xml);
 let locks=0;
 const execute=(_bin,args)=>{
  seen.push(args);
  if(args[0]==='/Query')return failTask?{status:1}:{status:0,stdout:Buffer.from('<Task>'+('x'.repeat(50))+'</Task>')};
  if(args[0]==='qe')return failEvent?{status:5}:{status:0,stdout:bytes};
  if(args[0]==='//NoLogo'){
   if(failWmi)return {status:2};
   const target=args.length===5?witness:owner;
   return {status:0,stdout:Buffer.from(JSON.stringify(target))};
  }
  throw Error('unexpected command');
 };
 const lock=()=>({status:'PRESENT',pid:5000,at:lockAt,
   hash:locks++===0?'SAME':secondHash});
 return {seen,ctx:{platform:'win32',clock,execute,readLock:lock,
  hashFile:file=>Object.values(APPROVED_VBS_CHAIN_FILES).find(v=>v.path===file)?.sha256}};
}
const run=f=>inspectInflationEvent129Once(f.ctx);
test('A diagnostic direct B proof reuses exact verification; VBS is not evaluated',async()=>{
 const f=fixture({owner:{...initial,ownerCreatedAtMs:start}});
 const r=await run(f);
 assert.equal(r.status,'PASS');assert.equal(r.code,'INFL_E129_B_DIRECT_LINK_OBSERVED');
 assert.equal(r.rawBDirect.ok,true);assert.equal(r.rawBVbs.ok,null);
 assert.equal(r.probeCounts.event,1);assert.equal(r.probeCounts.wmi,1);
 assert.equal(r.lock.same,true);
});
test('direct path failure then approved VBS chain success is not overall failure',async()=>{
 const f=fixture({xml:event('C:\\Windows\\System32\\wscript.exe',8000)});
 const r=await run(f);
 assert.equal(r.rawBDirect.ok,false);assert.equal(r.rawBVbs.ok,true);
 assert.equal(r.code,'INFL_E129_B_VBS_LINK_OBSERVED');
 assert.equal(r.probeCounts.wmi,2);assert.equal(r.rawBVbs.candidates.length,1);
});
test('all failed candidates remain fail-closed and distinguish failed B stages',async()=>{
 const f=fixture({xml:event('C:\\Windows\\System32\\wscript.exe',8000),
  witness:{...vbs,taskVbsLinked:false}});
 const r=await run(f);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.rawBDirect.ok,false);assert.equal(r.rawBVbs.ok,false);
 assert.equal(r.rawBVbs.candidates[0].code,'INFL_E129_VBS_ANCESTRY_UNVERIFIED');
 assert.equal(r.authorizesB,false);
});
test('UTF16 BOM auxiliary parse is explicitly separate from raw B failure',async()=>{
 const src=event();
 const byte=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(src,'utf16le')]);
 const r=await run(fixture({xml:byte}));
 assert.equal(r.bom,'UTF16LE');assert.equal(r.rawBDirect.ok,false);
 assert.equal(r.supplemental.onlySupplemental,true);
 assert.equal(r.status,'STATE_UNKNOWN');
});
test('reader denial, task failure, WMI failure remain distinct and no GET occurs',async()=>{
 for(const [key,code] of [['failTask','INFL_E129_TASK_DEFINITION_UNAVAILABLE'],
  ['failWmi','INFL_E129_TASK_OR_WMI_UNAVAILABLE'],
  ['failEvent','INFL_E129_READER_UNAVAILABLE']]){
  const f=fixture({[key]:true}),r=await run(f);
  assert.equal(r.code,code);assert.equal(r.status,'STATE_UNKNOWN');
  assert.equal(r.probeCounts.event,key==='failEvent'?1:0);
 }
});
test('empty event and incomplete EventData do not become actual owner mismatch',async()=>{
 for(const xml of ['<Events></Events>',event().replace(/<Data Name="ProcessID">5000<\/Data>/,'')]){
  const r=await run(fixture({xml}));
  assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.code,'INFL_E129_NOT_OBSERVED_WITHIN_LIMIT');
  assert.equal(r.rawBVbs.ok,false);assert.equal(r.event.pidMatch,0);
 }
});
test('window cap is explicit and never claims owner mismatch',async()=>{
 const xml='<Events>'+Array.from({length:64},(_,i)=>event('E:\\ZGmini\\runtime\\node.exe',i+1)
  .replace(/^<Events>/,'').replace(/<\/Events>$/,'')).join('')+'</Events>';
 const r=await run(fixture({xml}));
 assert.equal(r.event.total,64);assert.equal(r.code,'INFL_E129_NOT_OBSERVED_WITHIN_LIMIT');
});
test('racing lock overrides direct success without removing proof evidence',async()=>{
 const f=fixture({owner:{...initial,ownerCreatedAtMs:start},secondHash:'CHANGED'});
 const r=await run(f);
 assert.equal(r.rawBDirect.ok,true);assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'INFL_E129_LOCK_SNAPSHOT_RACE');assert.equal(r.lock.same,false);
});
test('unexecuted checks are null/NOT_EVALUATED not false',async()=>{
 const r=await run(fixture({failTask:true}));
 assert.equal(r.rawBDirect.ok,null);assert.equal(r.rawBVbs.ok,null);
 assert.equal(r.encoding,'NOT_EVALUATED');
 assert.equal(r.wmi.ownerFound,null);
});
test('bounded sanitized reporting never emits PID, paths, commands, XML or secrets',async()=>{
 const f=fixture({xml:event()+'SECRET_CREDENTIAL_VALUE_XYZ'});
 const r=await run(f);
 const json=JSON.stringify(r);
 assert.ok(json.length<8192);
 for(const secret of ['SECRET_CREDENTIAL_VALUE_XYZ','5000','E:\\ZGmini','CommandLine','<Event'])
  assert.equal(json.includes(secret),false);
 assert.deepEqual({providerCalls:r.providerCalls,operationalWrites:r.operationalWrites,
  d1Writes:r.d1Writes,sqliteOpened:r.sqliteOpened},
  {providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:false});
 assert.equal(f.seen.filter(a=>a[0]==='qe').length,1);
 assert.equal(f.seen.filter(a=>a[0]==='//NoLogo').length<=7,true);
});
test('event auxiliary classification is not a proof and detects missing field',()=>{
 const d=describeEvent129(event(),5000,start,start+20000,clock);
 assert.equal(d.systemMatch,1);assert.equal(d.taskMatch,1);assert.equal(d.pidMatch,1);
 const bad=describeEvent129(event().replace('ProcessID','Other'),5000,start,start+20000,clock);
 assert.equal(bad.fieldsPresent,0);
});

test('UTF8 BOM remains a valid raw B event while UTF16BE stays auxiliary only',async()=>{
 const text=event();
 const utf8=Buffer.concat([Buffer.from([239,187,191]),Buffer.from(text)]);
 const a=await run(fixture({xml:utf8,owner:{...initial,ownerCreatedAtMs:start}}));
 assert.equal(a.bom,'UTF8');assert.equal(a.rawBDirect.ok,true);
 const le=Buffer.from(text,'utf16le'),be=Buffer.alloc(le.length);
 for(let i=0;i<le.length;i+=2){be[i]=le[i+1];be[i+1]=le[i];}
 const b=await run(fixture({xml:Buffer.concat([Buffer.from([254,255]),be])}));
 assert.equal(b.bom,'UTF16BE');assert.equal(b.supplemental.onlySupplemental,true);
 assert.equal(b.rawBDirect.ok,false);assert.equal(b.status,'STATE_UNKNOWN');
});
test('field presence and time delta are bounded separate diagnostic counters',()=>{
 const out=describeEvent129(event(),5000,start,start+20000,clock);
 assert.deepEqual(out.fieldCounts,{TaskName:1,Path:1,ProcessID:1,TimeCreated:1});
 assert.equal(out.timeDeltaMs,0);
 const missing=describeEvent129(event().replace('TimeCreated SystemTime','Unknown Time'),5000,start,start+20000,clock);
 assert.equal(missing.fieldCounts.TimeCreated,0);
});
test('dedicated JScript witness reports empty Task instances versus task/WMI errors',async()=>{
 const fs=await import('node:fs'),vm=await import('node:vm');
 const code=fs.readFileSync(new URL('./inflation-core-owner-diagnostic-probe.mjs',import.meta.url),'utf8');
 function invoke({instances=0,taskFails=false,wmiFails=false}={}){
  const result=[];
  const script={WScript:{Arguments:{length:1,Item:()=>String(5000)},Echo:x=>result.push(x)},
   ActiveXObject:function(){return{Connect:()=>{},GetFolder:()=>({
    GetTask:()=>({Enabled:true,State:4,GetInstances:()=>{
     if(taskFails)throw Error('private task error');
     return {Count:instances,Item:()=>({EnginePID:5000})};
    }})})};},
   GetObject:()=>{if(wmiFails)throw Error('private wmi error');return{
    ExecQuery:()=>[{ProcessId:5000,ParentProcessId:9000,Name:'node.exe',
     CommandLine:'"E:\\ZGmini\\runtime\\node.exe" "E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release\\scripts\\pc-writer\\local-cycle.mjs" --publish',
     CreationDate:'20261115230010.000000+540'}]};},
   Enumerator:function(a){let n=0;this.atEnd=()=>n>=a.length;
    this.moveNext=()=>n++;this.item=()=>a[n];}};
  vm.runInNewContext(code,script,{timeout:2000});
  return JSON.parse(result[0]);
 }
 const empty=invoke();
 assert.equal(empty.taskInstanceStatus,'EMPTY');
 assert.equal(empty.wmiStatus,'OK');assert.equal(empty.ownerFound,true);
 assert.equal(invoke({taskFails:true}).taskInstanceStatus,'ERROR');
 assert.equal(invoke({wmiFails:true}).wmiStatus,'ERROR');
 assert.doesNotMatch(JSON.stringify(invoke({wmiFails:true})),/private|CommandLine|5000/);
});


test('initial absent lock stays LOCK_NOT_VERIFIED, not a fabricated lock race',async()=>{
 const f=fixture();
 let reads=0;
 f.ctx.readLock=()=>{reads++;return {status:'ABSENT'};};
 const r=await run(f);
 assert.equal(r.code,'INFL_E129_LOCK_NOT_VERIFIED');
 assert.equal(r.firstFailCode,'INFL_E129_LOCK_NOT_VERIFIED');
 assert.equal(r.stage,'LOCK');
 assert.equal(r.lock.before,'ABSENT');
 assert.equal(r.lock.after,'ABSENT');
 assert.equal(r.lock.same,null);
 assert.equal(reads,2);
 assert.equal(f.seen.length,0);
});

test('invalid first lock followed by a valid lock remains initial lock verification failure',async()=>{
 const f=fixture();
 let reads=0;
 f.ctx.readLock=()=>++reads===1?{status:'INVALID'}:
  {status:'PRESENT',pid:5000,at:start+20000,hash:'LATER'};
 const r=await run(f);
 assert.equal(r.code,'INFL_E129_LOCK_NOT_VERIFIED');
 assert.equal(r.firstFailCode,'INFL_E129_LOCK_NOT_VERIFIED');
 assert.equal(r.lock.same,null);
 assert.equal(r.probeCounts.event,0);
});

test('lock replacement after independent reader failure preserves first failed reader step',async()=>{
 const f=fixture({failEvent:true,secondHash:'CHANGED'});
 const r=await run(f);
 assert.equal(r.code,'INFL_E129_LOCK_SNAPSHOT_RACE');
 assert.equal(r.firstFailCode,'INFL_E129_READER_UNAVAILABLE');
 assert.equal(r.stage,'READER');
 assert.equal(r.lock.same,false);
 assert.equal(r.status,'STATE_UNKNOWN');
});

test('unavailable final lock is readback uncertainty, not fabricated replacement',async()=>{
 const f=fixture({owner:{...initial,ownerCreatedAtMs:start}});
 let reads=0;
 f.ctx.readLock=()=>++reads===1?
  {status:'PRESENT',pid:5000,at:start+20000,hash:'LOCK'}:
  {status:'UNAVAILABLE'};
 const r=await run(f);
 assert.equal(r.rawBDirect.ok,true);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'INFL_E129_LOCK_READBACK_UNVERIFIED');
 assert.equal(r.firstFailCode,'INFL_E129_LOCK_READBACK_UNVERIFIED');
 assert.equal(r.lock.same,null);
 assert.equal(r.stage,'AFTER_LOCK');
});

test('exception in lock recheck is UNKNOWN while initial errors keep their first fail',async()=>{
 const f=fixture({failWmi:true});
 let reads=0;
 f.ctx.readLock=()=>{
  if(++reads===1)return {status:'PRESENT',pid:5000,at:start+20000,hash:'LOCK'};
  throw Error('private lock readback message');
 };
 const r=await run(f);
 assert.equal(r.code,'INFL_E129_LOCK_READBACK_UNVERIFIED');
 assert.equal(r.firstFailCode,'INFL_E129_TASK_OR_WMI_UNAVAILABLE');
 assert.equal(r.stage,'WMI');
 assert.doesNotMatch(JSON.stringify(r),/private lock readback message/);
});
