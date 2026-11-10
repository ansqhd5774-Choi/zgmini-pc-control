// #996 Windows archive adapter DESIGN CANDIDATE — SOURCE/TEST ONLY.
// NEVER invokes .NET Directory.Move, PowerShell, CMD or an original PC path.
// The exact immutable, consent-bound Windows implementation is separate work.
// The intended native primitive is [System.IO.Directory]::Move(source,dest),
// which refuses an already-existing destination and cross-volume moves.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ROOT='E:\\ZGmini';
const ORIGINAL='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const LEASES='E:\\ZGmini\\automation\\pc-maintenance\\leases';
const H64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const UUID=x=>typeof x==='string'&&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const error=code=>Object.freeze({status:'C_996_WINDOWS_ARCHIVE_TEST_BLOCKED',
  code,productionExecutable:false,executionAuthorized:false,
  workflowPuts:0,issuePosts:0,pcRetries:0});

/** This only constructs an unexecutable, immutable Windows path contract. */
export function plan996WindowsArchive(continuationId){
  need(UUID(continuationId),
    'C_996_WINDOWS_ARCHIVE_NEW_ID_INVALID');
  const dirs=[
    ['oldC',`${LEASES}\\controller-recovery`,
      `${LEASES}\\controller-recovery-archived-${ORIGINAL}`],
    ['install',`${LEASES}\\controller-install`,
      `${LEASES}\\controller-install-recovered-${ORIGINAL}`],
    ['continuation',`${LEASES}\\controller-recovery-continuation-${continuationId}`,
      `${LEASES}\\controller-recovery-continuation-archived-${continuationId}`],
  ];
  const steps=dirs.map(([name,from,to])=>{
    need(path.win32.dirname(from)===LEASES&&
      path.win32.dirname(to)===LEASES&&
      path.win32.parse(from).root===path.win32.parse(to).root&&
      from!==to,'C_996_WINDOWS_ARCHIVE_PATH_UNSAFE');
    return Object.freeze({name,source:from,destination:to,
      intendedNativeOperation:'DOTNET_DIRECTORY_MOVE_NO_REPLACE'});
  });
  return Object.freeze({schema:'ZGMINI_CONTROLLER_996_WINDOWS_ARCHIVE_PLAN_V1',
    root:ROOT,originalRequestId:ORIGINAL,continuationId,
    steps:Object.freeze(steps),productionExecutable:false,
    executionAuthorized:false});
}

const relSafe=x=>typeof x==='string'&&x.length>0&&
  !x.includes('\\')&&!path.isAbsolute(x)&&
  x.split('/').every(p=>p&&p!=='.'&&p!=='..');
function safeDir(root,rel){
  need(relSafe(rel),'C_996_WINDOWS_ARCHIVE_REL_PATH_INVALID');
  let at=root;
  for(const part of [null,...rel.split('/')]){
    if(part!==null)at=path.join(at,part);
    const st=fs.lstatSync(at);
    need(st.isDirectory()&&!st.isSymbolicLink(),
      'C_996_WINDOWS_ARCHIVE_REDIRECT');
  }
  return at;
}
function absent(root,rel){
  safeDir(root,path.posix.dirname(rel));
  const dest=path.join(root,...rel.split('/'));
  try{fs.lstatSync(dest);return false;}
  catch(e){if(e.code==='ENOENT')return true;throw e;}
}
function inventory(root,rel){
  const out=Object.create(null);
  const visit=(base,at)=>{
    for(const name of fs.readdirSync(at).sort()){
      const full=path.join(at,name),stat=fs.lstatSync(full);
      need(!stat.isSymbolicLink(),
        'C_996_WINDOWS_ARCHIVE_CONTENT_REDIRECT');
      const item=base?base+'/'+name:name;
      if(stat.isDirectory())visit(item,full);
      else{
        need(stat.isFile()&&stat.nlink===1&&stat.size>0&&
          stat.size<=2_000_000,
          'C_996_WINDOWS_ARCHIVE_CONTENT_UNSAFE');
        out[item]=sha(fs.readFileSync(full));
      }
    }
  };
  visit('',safeDir(root,rel));
  return out;
}
const sameInventory=(observed,expected)=>
  expected&&typeof expected==='object'&&!Array.isArray(expected)&&
  Object.keys(observed).length===Object.keys(expected).length&&
  Object.entries(observed).every(([p,digest])=>
    Object.hasOwn(expected,p)&&expected[p]===digest&&H64(digest));

/**
 * Test-only fault injection and behavioral contract; `port.moveNoReplace`
 * MUST be supplied by a disposable fixture. Never use this as an operator.
 */
export function simulate996WindowsArchiveAdapter({testOnly=false,root=null,
  plan=null,expected=null,readLive=null,port=null,
  failAfter=null}={}){
  if(!testOnly||process.platform==='win32')return error(
    'C_996_WINDOWS_ARCHIVE_PRODUCTION_DISABLED');
  try{
    need(typeof root==='string'&&path.isAbsolute(root)&&
      path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&
      path.basename(root).startsWith('zgmini-996-test-')&&
      fs.lstatSync(root).isDirectory()&&
      !fs.lstatSync(root).isSymbolicLink(),
    'C_996_WINDOWS_ARCHIVE_FIXTURE_INVALID');
    need(plan?.schema==='ZGMINI_CONTROLLER_996_WINDOWS_ARCHIVE_PLAN_V1'&&
      plan.executionAuthorized===false&&
      JSON.stringify(plan)===JSON.stringify(plan996WindowsArchive(plan.continuationId))&&
      expected&&Object.keys(expected).length===3&&
      typeof readLive==='function'&&
      port&&typeof port.moveNoReplace==='function'&&
      [null,'AFTER_OLD_C','AFTER_INSTALL'].includes(failAfter),
      'C_996_WINDOWS_ARCHIVE_TEST_PORT_UNVERIFIED');
    const nameMap={oldC:'oldC',install:'install',continuation:'continuation'};
    const local=step=>`leases/${step.name}`;
    const archive=step=>`archives/${step.name}`;
    // Preflight checks ALL three source snapshots; a missing/new archive
    // blocks before any test write, even if only the last step is contested.
    for(const step of plan.steps){
      need(Object.hasOwn(nameMap,step.name)&&
        sameInventory(inventory(root,local(step)),expected[step.name])&&
        Object.keys(expected[step.name]).length>0,
        'C_996_WINDOWS_ARCHIVE_SOURCE_DRIFT');
      need(absent(root,archive(step)),
        'C_996_WINDOWS_ARCHIVE_DESTINATION_EXISTS');
    }
    for(const step of plan.steps){
      const state=readLive();
      need(state?.controllerConflictCount===0&&
        state?.writerConflictCount===0&&
        state?.protectionVerified===true&&
        state?.workflowState==='active',
        'C_996_WINDOWS_ARCHIVE_LATE_CONFLICT');
      need(sameInventory(inventory(root,local(step)),expected[step.name]),
        'C_996_WINDOWS_ARCHIVE_SOURCE_CHANGED');
      need(absent(root,archive(step)),
        'C_996_WINDOWS_ARCHIVE_LATE_DESTINATION_EXISTS');
      // Supplied port emulates .NET no-replace semantics in a temp fixture.
      // The production Windows implementation MUST NOT accept a JS port.
      port.moveNoReplace(root,local(step),archive(step));
      need(absent(root,local(step))&&
        sameInventory(inventory(root,archive(step)),expected[step.name]),
        'C_996_WINDOWS_ARCHIVE_POSTMOVE_UNKNOWN');
      if((step.name==='oldC'&&failAfter==='AFTER_OLD_C')||
        (step.name==='install'&&failAfter==='AFTER_INSTALL'))
        need(false,'C_996_WINDOWS_ARCHIVE_INJECTED_INTERRUPTION');
    }
    return Object.freeze({status:'C_996_WINDOWS_ARCHIVE_TEST_ONLY_PASS',
      steps:3,oldCBeforeInstall:true,installBeforeContinuation:true,
      productionExecutable:false,executionAuthorized:false,
      workflowPuts:0,issuePosts:0,pcRetries:0});
  }catch(e){return error(/^C_996_WINDOWS_ARCHIVE_[A-Z0-9_]+$/.test(e?.code??'')?
    e.code:'C_996_WINDOWS_ARCHIVE_STATE_UNKNOWN');}
}
