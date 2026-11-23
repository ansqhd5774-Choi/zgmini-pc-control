// Fixed BEA NIPA source-owner B effect. This is not an approval or a CLI.
// The shared direct B receiver authenticates the immutable approval before entry.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
  from '../r17-writer-b/r17-b-claim.mjs';

export const BEA_B_SCHEMA='ZGMINI_BEA_NIPA_SOURCE_ONCE_APPROVAL_V1';
export const BEA_B_SCOPE='BEA_T11500_Q_A463RD_LINE7_PRIVATE_ARCHIVE_ONCE';
export const BEA_B_MODE='BEA_NIPA_PRIVATE_ARCHIVE_ONCE';
const SOURCE='ansqhd5774-Choi/zgmini';
const RUNNER='scripts/pc-writer/EARNINGS_BEA_UNIT_NIPA_SOURCE_OWNER_R1.mjs';
const PC_ROOT=String.raw`E:\ZGmini\data\pc-writer`;
const INSTALLED=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const stop=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const EFFECT_KEYS=['providerCalls','privateArchiveWrites','attemptMarkerWrite','sqliteWrites','d1Writes',
  'taskDefinitionChanges','newTasks','otherOperationalFiles'];
const APPROVAL_KEYS=['schema','status','scope','sourceRepository','sourceSha',
  'profileId','runnerPath','installedSourceSha','dataRoot','sourceRoot',
  'runCount','effects'];
export function isApprovedBeaNativeSource(m){
  return exact(m,APPROVAL_KEYS)&&m.schema===BEA_B_SCHEMA&&
    m.status==='APPROVED_B'&&m.scope===BEA_B_SCOPE&&
    m.sourceRepository===SOURCE&&SHA40.test(m.sourceSha??'')&&
    m.profileId==='bea-unit-nipa-r1'&&m.runnerPath===RUNNER&&
    SHA40.test(m.installedSourceSha??'')&&m.sourceRoot===INSTALLED&&
    m.dataRoot===PC_ROOT&&m.runCount===1&&
    exact(m.effects,EFFECT_KEYS)&&m.effects.providerCalls===1&&
    m.effects.privateArchiveWrites===true&&
    m.effects.attemptMarkerWrite===true&&
    EFFECT_KEYS.filter(x=>x!=='providerCalls'&&x!=='privateArchiveWrites'&&
        x!=='attemptMarkerWrite')
      .every(x=>m.effects[x]===false);
}
function safeGitHead(directory){
  const binaries=[String.raw`C:\Program Files\Git\cmd\git.exe`,
    String.raw`C:\Program Files\Git\bin\git.exe`];
  const binary=binaries.find(x=>fs.existsSync(x));
  need(binary,'DIRECT_B_BEA_GIT_UNAVAILABLE');
  const result=spawnSync(binary,['-C',directory,'rev-parse','HEAD'],{
    encoding:'utf8',shell:false,windowsHide:true,timeout:12000,maxBuffer:512});
  need(result.status===0&&SHA40.test(result.stdout?.trim()??''),
    'DIRECT_B_BEA_INSTALLED_HEAD_UNVERIFIED');
  return result.stdout.trim();
}
function readBoundConfig(){
  const filename=path.join(PC_ROOT,'config.json');
  const stat=fs.lstatSync(filename);
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<100000,
    'DIRECT_B_BEA_CONFIG_SHAPE_STOP');
  const config=JSON.parse(fs.readFileSync(filename,'utf8'));
  need(SHA40.test(config.source??''),'DIRECT_B_BEA_CONFIG_SOURCE_STOP');
  return config.source;
}
export function verifyBeaInstalledBinding(m,{head,configSource}){
  need(isApprovedBeaNativeSource(m),'DIRECT_B_BEA_EFFECT_SCOPE_STOP');
  need(head===m.installedSourceSha&&configSource===head,
    'DIRECT_B_BEA_PC_SOURCE_CAS_STOP');
  return true;
}
const resultKeys=['status','providerRequests','sourceVersion',
  'sourceHttpSha256','sourceStoredAt','observedThrough'];
export function verifyBeaCapture(value){
  need(exact(value,resultKeys)&&['SOURCE_STORED_READBACK_VERIFIED','ALREADY_CAPTURED'].includes(value.status)&&
    value.providerRequests===1&&SHA64.test(value.sourceVersion??'')&&
    SHA64.test(value.sourceHttpSha256??'')&&
    Number.isSafeInteger(value.sourceStoredAt)&&value.sourceStoredAt>0&&
    /^\d{4}Q[1-4]$/.test(value.observedThrough??''),
    'DIRECT_B_BEA_ARCHIVE_READBACK_STOP');
  return {sourceVersion:value.sourceVersion,
    sourceHttpSha256:value.sourceHttpSha256,
    sourceStoredAt:value.sourceStoredAt,
    observedThrough:value.observedThrough};
}
export function verifyBeaReadback(capture,readback){
  need(readback?.status==='SOURCE_READBACK_VERIFIED'&&
    readback.sourceVersion===capture.sourceVersion&&
    readback.sourceHttpSha256===capture.sourceHttpSha256&&
    readback.sourceStoredAt===capture.sourceStoredAt&&
    readback.observedThrough===capture.observedThrough,
    'DIRECT_B_BEA_INDEPENDENT_READBACK_STOP');
  return true;
}
// Installed source is used only as a CAS preimage; the effect implementation is
// the immutable, reviewed Actions candidate checkout pinned by manifest.sourceSha.
export async function runBeaNativeSourceOnce(auth,{candidateRoot,
  installedHead=safeGitHead,installedConfig=readBoundConfig,
  providerLoader=null,collector=null,archiveReader=null}={}){
  const m=auth?.manifest;
  need(isApprovedBeaNativeSource(m),'DIRECT_B_BEA_EFFECT_SCOPE_STOP');
  need(process.platform==='win32'||(providerLoader&&collector),
    'DIRECT_B_BEA_WINDOWS_REQUIRED');
  need(typeof candidateRoot==='string'&&path.isAbsolute(candidateRoot),
    'DIRECT_B_BEA_CANDIDATE_ROOT_STOP');
  verifyBeaInstalledBinding(m,{
    head:installedHead(m.sourceRoot),configSource:installedConfig()});
  const root=path.resolve(candidateRoot);
  const sourceFile=path.join(root,...RUNNER.split('/'));
  const envFile=path.join(root,'scripts','pc-writer','local-env.mjs');
  const archiveFile=path.join(root,'scripts','pc-writer',
    'EARNINGS_BEA_UNIT_NIPA_ARCHIVE_R1.mjs');
  for(const filename of [sourceFile,envFile,archiveFile]){
    const st=fs.lstatSync(filename);
    need(st.isFile()&&!st.isSymbolicLink()&&st.size<200000,
      'DIRECT_B_BEA_CANDIDATE_FILE_STOP');
    need(path.relative(root,filename).split(path.sep)[0]!=='..',
      'DIRECT_B_BEA_CANDIDATE_PATH_STOP');
  }
  // Credential availability and pinned module loading are preflight: a missing
  // credential must never consume the one-shot durable attempt marker.
  const providers=providerLoader?await providerLoader(PC_ROOT):
    (await import(pathToFileURL(envFile).href)).loadLocalProviders(PC_ROOT);
  need(typeof providers?.BEA_API_KEY==='string'&&
    providers.BEA_API_KEY.trim().length>0,
    'DIRECT_B_BEA_CREDENTIAL_UNAVAILABLE');
  const perform=collector??(await import(pathToFileURL(sourceFile).href))
    .collectBeaUnitNipaSourceOnce;
  need(typeof perform==='function','DIRECT_B_BEA_COLLECTOR_UNAVAILABLE');
  const readArchive=archiveReader??(await import(pathToFileURL(archiveFile).href))
    .readBeaUnitNipaArchive;
  need(typeof readArchive==='function','DIRECT_B_BEA_READBACK_UNAVAILABLE');
  const journalRoot=path.join(PC_ROOT,'bea-nipa-source-b-once');
  const sharedLock=path.join(PC_ROOT,'writer-source-install.lock');
  const requestId=auth.request.requestId;
  // Share the installed Writer B mutex; do not create a competing lock
  // or touch the existing Core lock.
  const lock=acquireInstallLock({journalRoot,requestId,sharedLock});
  let attempted=false,retain=false;
  try{
    // Re-check installed source/config under the actual Writer lease.
    verifyBeaInstalledBinding(m,{
      head:installedHead(m.sourceRoot),configSource:installedConfig()});
    const claim=createInstallJournal({journalRoot,requestId,sharedLock,
      fd:lock.fd});
    const marker=path.join(claim.journalDir,'attempt.json');
    fs.writeFileSync(marker,JSON.stringify({
      schema:'ZGMINI_BEA_NIPA_SINGLE_ATTEMPT_V1',
      requestId,sourceSha:m.sourceSha,
      manifestSha256:auth.request.approvalManifestSha256,
      attemptedAt:new Date().toISOString()
    })+'\\n',{flag:'wx'});
    attempted=true;
    const value=await perform({pcBase:PC_ROOT,providers});
    const capture=verifyBeaCapture(value);
    verifyBeaReadback(capture,await readArchive({pcBase:PC_ROOT,
      sourceSha:capture.sourceVersion}));
    return {status:'PASS',providerRequests:1,privateArchiveWrites:1,...capture};
  }catch(error){
    if(attempted){
      // Original claim + immutable marker survive ambiguous completion.
      // Never replay the external GET under the same requestId.
      return {status:'STATE_UNKNOWN',
        code:'DIRECT_B_BEA_ATTEMPT_RECONCILE_REQUIRED'};
    }
    throw Object.assign(Error('DIRECT_B_BEA_PREFLIGHT_STOP'),
      {code:'DIRECT_B_BEA_PREFLIGHT_STOP'});
  }finally{
    // Keep the durable attempt evidence; release only the exact owned lock.
    // No forced lock removal or deletion of other Writer claims.
    releaseInstallClaim({fd:lock.fd,sharedLock,requestId,retain});
  }
}
