// Fixed offline Windows proof for the existing configured-theme runtime.
// No scheduled CLI, provider network, D1, production data write or shell.
// Only approved immutable old/new module roots are imported. All fixture
// state, checkpoints and output are contained in RUNNER_TEMP.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
  from '../../r17-writer-b/r17-b-claim.mjs';

const SCHEMA='ZGMINI_CONFIGURED_OLD_NEW_WINDOWS_PROOF_V1';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const VERSION=/^[a-f0-9]{16}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(v,code)=>{if(!v)fail(code);};
const sourceModule=(root,rel)=>import(pathToFileURL(
  path.join(root,...rel.split('/'))).href);
const REGISTRY='scripts/pc-writer/theme-config-registry.mjs';
const TOOL='scripts/pc-writer/theme-config-tool.mjs';
const STORE='scripts/pc-writer/theme-platform-store.mjs';
const DEFINITION=Object.freeze({
  schema:'ZGMINI_THEME_CONFIG_V1',id:'fixture-theme',
  label:'격리 호환성 확인',provider:'getmarkethistory',
  profile:'ADAPTIVE_R2_PAIR_R3',etfs:['AAA','BBB'],
  benchmark:'SPY',startDate:'2023-01-01',
});
const END='2026-10-28';
const NOW=new Date('2026-10-28T00:00:00Z');
const KEY='a'.repeat(64);
const LEGACY={themes:[{id:'biotech',label:'바이오·신약'}]};

function realDirectory(root){
  need(typeof root==='string'&&path.isAbsolute(root),
    'B_CROSS_ROOT_ABSOLUTE');
  const resolved=path.resolve(root),stat=fs.lstatSync(resolved);
  const normalize=value=>process.platform==='win32'?
    value.toLowerCase():value;
  need(stat.isDirectory()&&!stat.isSymbolicLink()&&
    normalize(fs.realpathSync(resolved))===normalize(resolved),
  'B_CROSS_ROOT_REDIRECT');
  return resolved;
}

// Reject an exported API change before executing any old or new function.
async function loadVersion(root,load){
  const [registry,tool,store]=await Promise.all([
    load(root,REGISTRY),load(root,TOOL),load(root,STORE)]);
  need(typeof registry?.registerDefinition==='function'&&
    typeof registry?.readRegistered==='function'&&
    typeof tool?.runConfiguredOnce==='function'&&
    typeof tool?.runConfiguredSchedule==='function'&&
    typeof tool?.planRegistered==='function'&&
    typeof store?.createThemeCheckpointStore==='function',
  'B_CROSS_VERSION_EXPORT_CONTRACT');
  return {registry,tool,store};
}

const fixtureFetch=metrics=>async (url,options)=>{
  metrics.mockFetchCalls++;
  const parsed=url instanceof URL?url:new URL(String(url));
  const symbol=parsed.pathname.split('/').at(-2);
  need(parsed.protocol==='https:'&&
    parsed.host==='getmarkethistory.com'&&
    parsed.pathname===`/api/v1/bars/stocks/${symbol}/1h`&&
    parsed.searchParams.get('format')==='jsonl'&&
    parsed.searchParams.get('columns')===
      'timestamp,close,symbol,is_gap'&&
    parsed.searchParams.get('end')===END&&
    ['AAA','BBB','SPY'].includes(symbol)&&
    options?.redirect==='error',
    'B_CROSS_UNEXPECTED_PROVIDER_REQUEST');
  return new Response(JSON.stringify({
    symbol,timestamp:'2026-10-27T19:00:00Z',close:100,
  })+'\n',{status:200});
};

async function privateCycle(writer,reader,root,metrics){
  const registered=writer.registry.registerDefinition({
    dataRoot:root,definition:DEFINITION,legacyRegistry:LEGACY});
  need(registered?.sha256&&
    reader.registry.readRegistered(root,DEFINITION.id)?.sha256===
      registered.sha256,'B_CROSS_REGISTRATION_READBACK');
  const fetchImpl=fixtureFetch(metrics);
  // The first version stops after its first mock page. The other version
  // resumes the same checksum-pinned collection, then the first rereads it.
  const first=await writer.tool.runConfiguredOnce({
    dataRoot:root,id:DEFINITION.id,end:END,fetchImpl,maxRequests:1});
  need(first?.collection?.providerCalls===1&&first.d1Writes===0,
    'B_CROSS_FIRST_PARTIAL_COLLECTION');
  const second=await reader.tool.runConfiguredOnce({
    dataRoot:root,id:DEFINITION.id,end:END,fetchImpl,maxRequests:4});
  need(second?.collection?.providerCalls>=0&&
    second.collection.providerCalls<=3&&second.d1Writes===0,
    'B_CROSS_RESUME_COLLECTION');
  const before=metrics.mockFetchCalls;
  const dedup=await writer.tool.runConfiguredOnce({
    dataRoot:root,id:DEFINITION.id,end:END,fetchImpl,maxRequests:4});
  need(dedup?.providerCalls===0&&metrics.mockFetchCalls===before,
    'B_CROSS_SAME_WINDOW_DUPLICATE_GET');
  metrics.d1Writes=(metrics.d1Writes??0)+
    first.d1Writes+second.d1Writes+(dedup.d1Writes??0);
  const state=path.join(root,'themes',registered.internalId,
    'state','configured-cycle.json');
  need(fs.lstatSync(state).isFile()&&!fs.lstatSync(state).isSymbolicLink(),
    'B_CROSS_CHECKPOINT_FILE_MISSING');
  const record=JSON.parse(fs.readFileSync(state,'utf8'));
  need(record.definitionSha256===registered.sha256&&
    record.start==='2023-01-01'&&record.end===END,
  'B_CROSS_CHECKPOINT_CONTRACT');
  const plan=reader.tool.planRegistered(root,DEFINITION.id);
  need(plan&&typeof plan.status==='string',
    'B_CROSS_READER_PLAN_UNAVAILABLE');
  metrics.cycleCheckpointSha256=sha(fs.readFileSync(state));
  metrics.sameWindowDedup=true;
}

async function checkpointRevision(writer,reader,root,metrics){
  const a=writer.store.createThemeCheckpointStore({dataRoot:root});
  const b=reader.store.createThemeCheckpointStore({dataRoot:root});
  const first={fingerprint:KEY,revision:1,pending:[],completed:{}};
  await a.save(KEY,first,0);
  need(JSON.stringify(await b.load(KEY))===JSON.stringify(first),
    'B_CROSS_REVISION_READ');
  const second={...first,revision:2,completed:{verified:true}};
  await b.save(KEY,second,1);
  need(JSON.stringify(await a.load(KEY))===JSON.stringify(second),
    'B_CROSS_REVISION_REVERSE_READ');
  let conflict=false;
  try{await a.save(KEY,{...second,revision:3},1);}
  catch(e){conflict=e?.code==='THEME_CHECKPOINT_CAS_CONFLICT';}
  need(conflict,'B_CROSS_CAS_REJECT_MISSING');
  metrics.revisions=2;
  metrics.casRejected=true;
  // Corruption must not be silently skipped by either version.
  const leaf=path.join(root,'theme-platform','checkpoints',KEY,
    'revision-2.json');
  fs.appendFileSync(leaf,'tamper');
  let aRejected=false,bRejected=false;
  try{await a.load(KEY);}catch{aRejected=true;}
  try{await b.load(KEY);}catch{bRejected=true;}
  need(aRejected&&bRejected,'B_CROSS_CHECKPOINT_TAMPER_ACCEPTED');
  metrics.tamperRejected=true;
}

async function dailyBudget(writer,reader,root,metrics){
  writer.registry.registerDefinition({
    dataRoot:root,definition:DEFINITION,legacyRegistry:LEGACY});
  const fetchImpl=fixtureFetch(metrics);
  const first=await writer.tool.runConfiguredSchedule({
    dataRoot:root,now:NOW,fetchImpl,resourcePolicy:{dailyProviderRequests:1}});
  need(first?.d1Writes===0&&first.providerCallsToday===1,
    'B_CROSS_DAILY_BUDGET_FIRST');
  const before=metrics.mockFetchCalls;
  const second=await reader.tool.runConfiguredSchedule({
    dataRoot:root,now:NOW,fetchImpl,resourcePolicy:{dailyProviderRequests:1}});
  need(second?.d1Writes===0&&second.providerCallsToday===1&&
    metrics.mockFetchCalls===before,'B_CROSS_DAILY_BUDGET_RESET');
  metrics.d1Writes+=first.d1Writes+second.d1Writes;
  metrics.sameDayBudgetRetained=true;
}

function isolatedWriterLease(root,metrics){
  const journalRoot=path.join(root,'journals');
  const sharedLock=path.join(root,'writer-source-install.lock');
  const firstId='fixture-old-to-new',secondId='fixture-new-to-old';
  const first=acquireInstallLock({journalRoot,sharedLock,
    requestId:firstId});
  let collision=false;
  try{
    try{acquireInstallLock({journalRoot,sharedLock,requestId:secondId});}
    catch(e){collision=e?.code==='R17_B_SHARED_INSTALL_BUSY_NOOP_STOP';}
    need(collision,'B_CROSS_SHARED_LOCK_COLLISION_NOT_REJECTED');
    createInstallJournal({journalRoot,sharedLock,requestId:firstId,fd:first.fd});
  }finally{
    releaseInstallClaim({fd:first.fd,sharedLock,requestId:firstId,retain:false});
  }
  const second=acquireInstallLock({journalRoot,sharedLock,
    requestId:secondId});
  try{createInstallJournal({journalRoot,sharedLock,
    requestId:secondId,fd:second.fd});}
  finally{releaseInstallClaim({fd:second.fd,sharedLock,
    requestId:secondId,retain:false});}
  let duplicate=false;
  try{acquireInstallLock({journalRoot,sharedLock,requestId:firstId});}
  catch(e){duplicate=e?.code==='R17_B_REQUEST_ALREADY_CLAIMED_STOP';}
  need(duplicate&&!fs.existsSync(sharedLock),
    'B_CROSS_ONESHOT_REUSE_OR_LOCK_LEAK');
  metrics.sharedLeaseCollisionRejected=true;
  metrics.oneShotReplayRejected=true;
}

/** Offline logic only; injectable module objects are never read from an Issue. */
export async function proveIsolatedOldNewFixtures({oldRuntime,newRuntime,
  runnerTemp,makeTemp=fs.mkdtempSync}={}){
  const metrics={externalNetworkCalls:0,d1Writes:0,
    simulations:[],mockFetchCalls:0};
  const hostFetch=globalThis.fetch;
  globalThis.fetch=async()=>{
    metrics.externalNetworkCalls++;
    fail('B_CROSS_EXTERNAL_FETCH_FORBIDDEN');
  };
  try{
    for(const [name,writer,reader] of [
      ['OLD_TO_NEW',oldRuntime,newRuntime],
      ['NEW_TO_OLD',newRuntime,oldRuntime]]){
      const root=makeTemp(path.join(runnerTemp,'zgmini-cross-'+
        name.toLowerCase()+'-'));
      realDirectory(root);
      const local={direction:name,mockFetchCalls:0,d1Writes:0};
      await privateCycle(writer,reader,root,local);
      await checkpointRevision(writer,reader,root,local);
      const budgetRoot=makeTemp(path.join(runnerTemp,
        'zgmini-cross-budget-'+name.toLowerCase()+'-'));
      realDirectory(budgetRoot);
      await dailyBudget(writer,reader,budgetRoot,local);
      metrics.simulations.push(local);
      metrics.mockFetchCalls+=local.mockFetchCalls;
      metrics.d1Writes+=local.d1Writes;
    }
    const leaseRoot=makeTemp(path.join(runnerTemp,
      'zgmini-cross-lease-'));
    isolatedWriterLease(leaseRoot,metrics);
  }finally{globalThis.fetch=hostFetch;}
  need(metrics.simulations.length===2&&
    metrics.simulations.every(x=>x.sameWindowDedup&&x.revisions===2&&
      x.casRejected&&x.tamperRejected&&x.sameDayBudgetRetained)&&
    metrics.sharedLeaseCollisionRejected&&metrics.oneShotReplayRejected&&
    metrics.externalNetworkCalls===0&&metrics.d1Writes===0,
  'B_CROSS_SIMULATION_INCOMPLETE');
  return metrics;
}

/** `load` and `platform` are injectable only by local source-only tests.
 * Production receiver calls this with fixed immutable paths and Windows. */
export async function runWindowsCrossVersionProof({approval,current,
  sourceRoot,packageRoot,oldActiveBytes,
  runnerTemp=process.env.RUNNER_TEMP,platform=process.platform,
  load=sourceModule,makeTemp=fs.mkdtempSync}={}){
  need(platform==='win32','B_CROSS_WINDOWS_REQUIRED');
  need(SHA40.test(approval?.sourceSha??'')&&
    approval.sourceSha===current?.sourceSha&&
    VERSION.test(current?.oldVersion??'')&&
    SHA64.test(current?.taskXmlSha256??'')&&
    Buffer.isBuffer(oldActiveBytes),
  'B_CROSS_INPUT_PIN');
  const active=JSON.parse(oldActiveBytes.toString('utf8'));
  need(active.version===current.oldVersion&&
    SHA40.test(active.sourceSha??'')&&
    active.sourceSha!==approval.sourceSha,
  'B_CROSS_INSTALLED_OLD_PIN');
  const oldRoot=realDirectory(path.join(
    'E:/ZGmini/data/pc-writer/theme-config-tool','versions',active.version));
  const newRoot=realDirectory(packageRoot);
  need(realDirectory(sourceRoot)&&realDirectory(runnerTemp),
    'B_CROSS_TRUSTED_DIRECTORIES');
  const hostFetch=globalThis.fetch;
  // Guard module initialization too: no old/new import may perform a provider
  // GET before the isolated mock collector installs its narrower guard.
  globalThis.fetch=async()=>fail('B_CROSS_IMPORT_NETWORK_FORBIDDEN');
  try{
    const [oldRuntime,newRuntime]=await Promise.all([
      loadVersion(oldRoot,load),loadVersion(newRoot,load)]);
    const metrics=await proveIsolatedOldNewFixtures({oldRuntime,newRuntime,
      runnerTemp,makeTemp});
    const transcript={schema:SCHEMA,sourceSha:approval.sourceSha,
      oldSourceSha:active.sourceSha,oldVersion:active.version,
      taskXmlSha256:current.taskXmlSha256,
      metrics};
    const evidenceSha256=sha(Buffer.from(JSON.stringify(transcript)));
    // This true flag is returned only after this Windows process executed
    // both directions and the isolated Writer lease replay checks.
    return Object.freeze({trustedRunnerVerified:true,evidenceSha256,
      oldVersion:current.oldVersion,newSourceSha:approval.sourceSha,
      taskXmlSha256:current.taskXmlSha256,transcript});
  }finally{globalThis.fetch=hostFetch;}
}
