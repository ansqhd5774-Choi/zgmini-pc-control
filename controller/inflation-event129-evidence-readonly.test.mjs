import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectInflationEvent129Once,describeEvent129,classifyEvent129ReaderShape}
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
 failEvent=false,failTask=false,failWmi=false,failLogConfig=false,
 logConfig='enabled: true',lockAt=start+20000}={}){
 const seen=[],bytes=Buffer.isBuffer(xml)?xml:Buffer.from(xml);
 let locks=0;
 const execute=(_bin,args)=>{
  seen.push(args);
  if(args[0]==='/Query')return failTask?{status:1}:{status:0,stdout:Buffer.from('<Task>'+('x'.repeat(50))+'</Task>')};
  if(args[0]==='qe')return failEvent?{status:5}:{status:0,stdout:bytes};
  if(args[0]==='gl')return failLogConfig?{status:5}:
   {status:0,stdout:Buffer.from(logConfig)};
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
test('read-only channel config identifies disabled log even when Core is idle',async()=>{
 const f=fixture({owner:{...initial,taskRunning:false,ownerCoreMatched:false},
  logConfig:'name: Microsoft-Windows-TaskScheduler/Operational\r\nenabled: false\r\n'});
 const r=await run(f);
 assert.deepEqual(r.logConfig,{read:'OK',enabled:false});
 assert.equal(r.probeCounts.logConfig,1);
 assert.equal(f.seen.filter(a=>a[0]==='gl').length,1);
 assert.equal(r.code,'INFL_E129_CORE_TASK_NOT_RUNNING_AT_SNAPSHOT');
 assert.equal(r.authorizesB,false);
});
test('channel config permission errors or ambiguous output stay unknown',async()=>{
 for(const options of [{failLogConfig:true},{logConfig:'ACCESS_DENIED'},
  {logConfig:'enabled: true\nenabled: false'}]){
  const r=await run(fixture(options));
  assert.equal(r.logConfig.enabled,null);
  assert.ok(['UNAVAILABLE','UNPARSEABLE'].includes(r.logConfig.read));
  assert.equal(r.providerCalls,0);
  assert.equal(r.authorizesB,false);
 }
});
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
  assert.equal(r.probeCounts.event,1);
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
 assert.equal(r.encoding,'UTF-8');assert.equal(r.reader,'OK');
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
 assert.equal(f.seen.filter(a=>a[0]==='qe').length,1);
 assert.equal(f.seen.filter(a=>a[0]==='//NoLogo').length,0);
 assert.equal(r.event.pidMatch,null);
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
 assert.equal(r.probeCounts.event,1);
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


test('current live WMI Core link follows actual B V2 shortcut and skips Event129',async()=>{
 const f=fixture({owner:{...initial,linked:true,ownerCoreMatched:true}});
 const r=await run(f);
 assert.equal(r.status,'PASS');
 assert.equal(r.code,'INFL_E129_CURRENT_WMI_LINK_OBSERVED');
 assert.equal(r.wmi.linked,true);
 assert.equal(r.rawBDirect.ok,null);
 assert.equal(r.rawBVbs.ok,null);
 assert.equal(r.reader,'NOT_EVALUATED');
 assert.equal(r.probeCounts.event,0);
 assert.equal(r.lock.same,true);
 assert.equal(r.authorizesB,false);
});
test('linked WMI owner with wrong Core command remains a B safety denial, not Event129',async()=>{
 const f=fixture({owner:{...initial,linked:true,ownerCoreMatched:false}});
 const r=await run(f);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'INFL_E129_LINKED_OWNER_SCRIPT_UNVERIFIED');
 assert.equal(r.firstFailCode,'INFL_E129_LINKED_OWNER_SCRIPT_UNVERIFIED');
 assert.equal(r.rawBDirect.code,'NOT_EVALUATED');
 assert.equal(r.probeCounts.event,1);
});
test('Korea shared-lock owner is a bounded one-shot observation, not Event129 mismatch',async()=>{
 const f=fixture({owner:{...initial,ownerKoreaMatched:true,ownerCoreMatched:false}});
 const r=await run(f);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'INFL_E129_NON_CORE_LOCK_OWNER_OBSERVED');
 assert.equal(r.wmi.koreaMatched,true);
 assert.equal(r.probeCounts.event,1);
 assert.equal(r.rawBVbs.ok,null);
});
test('Task not running at snapshot does not become Event129 proof failure',async()=>{
 const f=fixture({owner:{...initial,taskRunning:false,ownerCoreMatched:false}});
 const r=await run(f);
 assert.equal(r.code,'INFL_E129_CORE_TASK_NOT_RUNNING_AT_SNAPSHOT');
 assert.equal(r.wmi.taskRunning,false);
 assert.equal(r.rawBDirect.ok,null);
 assert.equal(r.probeCounts.event,1);
});
test('stale Core lock older than one hour rejects owner but retains log coverage',async()=>{
 const f=fixture({lockAt:start-3600000});
 const r=await run(f);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'INFL_E129_LOCK_AGE_OUT_OF_WINDOW');
 assert.equal(r.stage,'LOCK');
 assert.equal(r.probeCounts.wmi,0);
 assert.equal(r.probeCounts.event,1);
 assert.equal(r.lock.same,true);
});
test('future lock timestamp is not a proven owner',async()=>{
 const f=fixture({lockAt:start+26000});
 const r=await run(f);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'INFL_E129_LOCK_AGE_OUT_OF_WINDOW');
 assert.equal(r.rawBDirect.ok,null);
 assert.equal(r.probeCounts.event,1);
});
test('current diagnostic process cannot certify its own PID as B Core owner',async()=>{
 const f=fixture();
 let reads=0;
 f.ctx.readLock=()=>({status:'PRESENT',pid:process.pid,at:start+20000,
  hash:++reads===1?'SAME':'SAME'});
 const r=await run(f);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'INFL_E129_LOCK_SELF_OWNER_UNVERIFIED');
 assert.equal(r.rawBDirect.ok,null);
 assert.equal(r.probeCounts.wmi,0);
 assert.equal(r.lock.same,true);
 assert.doesNotMatch(JSON.stringify(r),/"(?:pid|lockPid|CommandLine)"\s*:/i);
});


test('idle Core still reports UTF16LE event reader and auxiliary structure, not B ownership',async()=>{
 const x=event(),f=fixture({xml:Buffer.concat([Buffer.from([255,254]),Buffer.from(x,'utf16le')])});
 f.ctx.readLock=()=>({status:'ABSENT'});
 const r=await run(f);
 assert.equal(r.code,'INFL_E129_LOCK_NOT_VERIFIED');
 assert.equal(r.firstFailCode,'INFL_E129_LOCK_NOT_VERIFIED');
 assert.equal(r.reader,'OK');
 assert.equal(r.bom,'UTF16LE');
 assert.equal(r.encoding,'UTF-16LE');
 assert.equal(r.supplemental.parsed,true);
 assert.equal(r.supplemental.coreCandidates,1);
 assert.equal(r.supplemental.onlySupplemental,true);
 assert.equal(r.event.pidMatch,null);
 assert.equal(r.rawBDirect.ok,null);
 assert.equal(r.rawBVbs.ok,null);
 assert.equal(r.probeCounts.event,1);
 assert.equal(r.probeCounts.taskDefinition,0);
 assert.equal(r.probeCounts.wmi,0);
 assert.equal(r.probeCounts.lockReads,2);
});
test('earlier Task error stays firstFail when log reader is also denied',async()=>{
 const f=fixture({failTask:true,failEvent:true}),r=await run(f);
 assert.equal(r.code,'INFL_E129_TASK_DEFINITION_UNAVAILABLE');
 assert.equal(r.firstFailCode,'INFL_E129_TASK_DEFINITION_UNAVAILABLE');
 assert.equal(r.stage,'TASK');
 assert.equal(r.reader,'ERROR');
 assert.equal(r.probeCounts.event,1);
 assert.equal(r.rawBDirect.ok,null);
 assert.equal(r.rawBVbs.ok,null);
 assert.equal(r.lock.same,true);
});
test('independent coverage never repeats Event129 after an attempted direct B proof',async()=>{
 const f=fixture({xml:'<Events></Events>'});
 const r=await run(f);
 assert.equal(r.code,'INFL_E129_NOT_OBSERVED_WITHIN_LIMIT');
 assert.equal(r.probeCounts.event,1);
 assert.equal(f.seen.filter(a=>a[0]==='qe').length,1);
 assert.equal(r.rawBDirect.ok,false);
});


test('reader shape differentiates an empty stdout from empty Event XML container',()=>{
 const empty=classifyEvent129ReaderShape(Buffer.alloc(0),'');
 const container=classifyEvent129ReaderShape(Buffer.from('<Events></Events>'),'<Events></Events>');
 assert.equal(empty.status,'EMPTY_STDOUT');
 assert.equal(empty.byteBand,'ZERO');
 assert.equal(empty.bEventRoots,0);
 assert.equal(container.status,'EMPTY_EVENTS_CONTAINER');
 assert.equal(container.bEventRoots,0);
});
test('recognized unprefixed Event root is only a reader shape, not owner evidence',()=>{
 const xml=event();
 const s=classifyEvent129ReaderShape(Buffer.from(xml),xml);
 assert.equal(s.status,'B_EVENT_ROOT_OBSERVED');
 assert.equal(s.bEventRoots,1);
 assert.equal(s.auxEventRoots,1);
 assert.equal(typeof s.xmlDeclaration,'boolean');
 assert.equal(s.byteBand,'UP_TO_1K');
 assert.equal(JSON.stringify(s).includes('5000'),false);
});
test('prefix-qualified Event is distinguished from B regex with no raw XML export',()=>{
 const xml='<Events><e:Event xmlns:e="urn:x"><e:EventID>129</e:EventID></e:Event></Events>';
 const s=classifyEvent129ReaderShape(Buffer.from(xml),xml);
 assert.equal(s.status,'PREFIXED_EVENT_NOT_B_RECOGNIZED');
 assert.equal(s.bEventRoots,0);
 assert.equal(s.auxEventRoots,1);
 assert.doesNotMatch(JSON.stringify(s),/urn:x|e:EventID|e:Event/);
});
test('an incomplete Event XML record is a format state, never a Core PID mismatch',()=>{
 const xml='<Events><Event xmlns="urn:example"><EventID>129</EventID>';
 const s=classifyEvent129ReaderShape(Buffer.from(xml),xml);
 assert.equal(s.status,'INCOMPLETE_EVENT_XML');
 assert.equal(s.bEventRoots,0);
 assert.equal(s.auxEventRoots,1);
});
test('non-XML stdout and whitespace are independent fixed states',()=>{
 const whitespace=classifyEvent129ReaderShape(Buffer.from(' \r\n\t'),' \r\n\t');
 const broken=classifyEvent129ReaderShape(Buffer.from('ERROR_PRIVATE_MESSAGE'),'ERROR_PRIVATE_MESSAGE');
 assert.equal(whitespace.status,'WHITESPACE_ONLY');
 assert.equal(broken.status,'NON_XML_STDOUT');
 assert.doesNotMatch(JSON.stringify(broken),/ERROR_PRIVATE_MESSAGE/);
});
test('UTF16LE without BOM is auxiliary evidence only, never a successful raw B proof',async()=>{
 const xml=event(),f=fixture({xml:Buffer.from(xml,'utf16le')});
 const r=await run(f);
 assert.equal(r.reader,'OK');
 assert.equal(r.bom,'NONE');
 assert.equal(r.readerShape.suspectedEncoding,'POSSIBLE_UTF16LE_NO_BOM');
 assert.equal(r.readerShape.status,'AUX_EVENT_ROOT_NOT_B_RECOGNIZED');
 assert.equal(r.readerShape.bEventRoots,0);
 assert.equal(r.readerShape.auxEventRoots,1);
 assert.equal(r.rawBDirect.ok,false);
 assert.equal(r.supplemental.onlySupplemental,true);
 assert.equal(r.status,'STATE_UNKNOWN');
});
test('valid Event reader with empty records retains bounded UNKNOWN and reports shape',async()=>{
 const f=fixture({xml:'<Events></Events>'});
 const r=await run(f);
 assert.equal(r.readerShape.status,'EMPTY_EVENTS_CONTAINER');
 assert.equal(r.firstFailCode,'INFL_E129_NOT_OBSERVED_WITHIN_LIMIT');
 assert.equal(r.rawBDirect.ok,false);
 assert.equal(r.probeCounts.event,1);
 assert.equal(r.authorizesB,false);
});
test('reader failure does not fabricate a parsed reader envelope',async()=>{
 const f=fixture({failEvent:true}),r=await run(f);
 assert.equal(r.code,'INFL_E129_READER_UNAVAILABLE');
 assert.equal(r.readerShape.status,'NOT_EVALUATED');
 assert.equal(r.readerShape.byteBand,'NOT_EVALUATED');
 assert.equal(r.readerShape.bEventRoots,null);
 assert.equal(r.probeCounts.event,1);
});
