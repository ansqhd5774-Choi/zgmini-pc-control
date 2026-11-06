// Upload only bounded sanitized read-only evidence to an existing PRIVATE
// control stage branch, exact byte GET readback, then comment on the ONE Issue.
// No PC operational file, public repository, provider, or database write.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {TARGET_BLOBS} from './contract.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const BRANCH='codex/calendar-parser-source-stage-20261107';
const API=`https://api.github.com/repos/${REPO}`;
const SCHEMA='ZGMINI_CALENDAR_SOURCE_PREFLIGHT_RESULT_V1';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const hdr=token=>({authorization:`Bearer ${token}`,
 accept:'application/vnd.github+json','x-github-api-version':'2022-11-28',
 'user-agent':'zgmini-calendar-source-preflight'});
export function sanitizeDiagnostic(raw){
 if(!raw||typeof raw!=='object')return null;
 const allowedExecutables=new Set(['node.exe','node','wscript.exe','cscript.exe',
  'cmd.exe','cmd']);
 const allowedScripts=new Set(['local-cycle.mjs','run-local.mjs','collect-local.mjs',
  'archive-run.mjs','earnings-api-local.mjs','run-local-core.vbs',
  'run-original-then-archive.vbs']);
 const executable=x=>typeof x==='string'?
  allowedExecutables.has(x.toLowerCase())?x.toLowerCase():'OTHER_EXECUTABLE':null;
 const script=x=>typeof x==='string'?
  allowedScripts.has(x.toLowerCase())?x.toLowerCase():'OTHER_SCRIPT':null;
 const nextHopKinds=new Set(['UNKNOWN','CMD_AMBIGUOUS','CORE_LOCAL_CYCLE',
  'WRITER_ONLY','ARCHIVE_SIDECAR','EARNINGS_SIDECAR','KNOWN_VBS_WRAPPER',
  'OTHER_VBS','OTHER_NODE_SCRIPT','OTHER_CMD_SCRIPT','NODE_NO_SCRIPT',
  'VBS_NO_SCRIPT','CMD_NO_SCRIPT','OTHER']);
 const safeHop=x=>nextHopKinds.has(x)?x:
  typeof x==='string'&&x.startsWith('CMD_ONE_HOP_')&&
  nextHopKinds.has(x.slice('CMD_ONE_HOP_'.length))?x:'UNKNOWN';
 const sites=Array.isArray(raw.callGraph)?raw.callGraph.slice(0,2):[];
 return {taskCommand:raw.taskCommand==='wscript.exe'?'wscript.exe':'unknown',
  firstLauncherShaVerified:raw.firstLauncherShaVerified===true,
  secondLauncherShaVerified:raw.secondLauncherShaVerified===true,
  containsSecondLauncher:raw.containsSecondLauncher===true,
  containsSourceRoot:raw.containsSourceRoot===true,
  containsLocalCycle:raw.containsLocalCycle===true,
  containsRunLocalCmd:raw.containsRunLocalCmd===true,
  strictStaticChainCandidate:raw.strictStaticChainCandidate===true,
  callGraph:sites.map((item,i)=>({launcher:i+1,
   callCount:Number.isInteger(item.callCount)&&item.callCount>=0&&item.callCount<=999?
    item.callCount:null,truncated:item.truncated===true,
   commentStripped:item.commentStripped===true,
   anyConditionalSyntax:item.anyConditionalSyntax===true,
   sourceRootMentioned:item.sourceRootMentioned===true,
   callSites:(Array.isArray(item.callSites)?item.callSites:[]).slice(0,4).map(site=>({
    api:['run','exec'].includes(site.api)?site.api:'unknown',
    argumentForm:['literal','concatenated','variable','complex']
     .includes(site.argumentForm)?site.argumentForm:'unknown',
    mentionsSecondLauncher:site.mentionsSecondLauncher===true,
    mentionsCoreScript:site.mentionsCoreScript===true,
    mentionsWriterOnly:site.mentionsWriterOnly===true,
    mentionsRunLocalCmd:site.mentionsRunLocalCmd===true,
    mentionsSourceRoot:site.mentionsSourceRoot===true,
   }))})),
  causality:(Array.isArray(raw.causality)?raw.causality:[]).slice(0,2)
   .map((trace,i)=>({launcher:i+1,
    callCount:Number.isInteger(trace.callCount)&&trace.callCount>=0&&
     trace.callCount<=8?trace.callCount:null,
    unresolvedCount:Number.isInteger(trace.unresolvedCount)&&
     trace.unresolvedCount>=0&&trace.unresolvedCount<=8?trace.unresolvedCount:null,
    branchSeen:trace.branchSeen===true,
    indirectExecutionSeen:trace.indirectExecutionSeen===true,
    sourceTooLarge:trace.sourceTooLarge===true,
    entirelyDeterministic:trace.entirelyDeterministic===true,
    allCallArgumentsResolved:trace.allCallArgumentsResolved===true,
    calls:(Array.isArray(trace.calls)?trace.calls:[]).slice(0,8).map(c=>({
     api:['run','exec'].includes(c.api)?c.api:'unknown',
     argumentForm:['literal','concatenated','variable','chr34','env','buildpath',
      'parentpath','scriptfull', 'UNRESOLVED'].includes(c.argumentForm)?
      c.argumentForm:'unknown',
     resolved:c.resolved===true,
     reason:typeof c.reason==='string'&&/^[A-Z_]{2,48}$/.test(c.reason)?
      c.reason:null,
     nextPinnedVbsDirect:c.nextPinnedVbsDirect===true,
     coreNodeEntrypointDirect:c.coreNodeEntrypointDirect===true,
     sourceRootReferenced:c.sourceRootReferenced===true,
     archiveSidecar:c.archiveSidecar===true,
     earningsSidecar:c.earningsSidecar===true,
     shellCmdAmbiguous:c.shellCmdAmbiguous===true,
     commandShape:c.commandShape&&typeof c.commandShape==='object'?{
      executableBasename:executable(c.commandShape.executableBasename),
      scriptBasename:script(c.commandShape.scriptBasename),
      scriptExtension:['.mjs','.js','.vbs','.cmd','.bat'].includes(
       c.commandShape.scriptExtension)?c.commandShape.scriptExtension:null,
      scriptRooted:c.commandShape.scriptRooted===true,
      approvedRootMatch:c.commandShape.approvedRootMatch===true,
      nextHopKind:safeHop(c.commandShape.nextHopKind),
      oneHopCmdParsed:c.commandShape.oneHopCmdParsed===true,
     }:null,
    }))})),
 };
}
export function sanitizeCandidateCheckout(raw){
 if(!raw||typeof raw!=='object')return null;
 const sha40=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x)?x:null;
 const safeCount=n=>Number.isInteger(n)&&n>=0&&n<=1000?n:null;
 const sha64=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x)?x:null;
 const approvedDirtyNames=new Set([...Object.keys(TARGET_BLOBS),
  'scripts/pc-writer/us-breadth-provisional-cycle.mjs',
  'scripts/pc-writer/us-breadth-sip-premarket-cycle.mjs',
  'lib/market-breadth/us-premarket-sip-r1.mjs']);
 const safePath=x=>typeof x==='string'&&x.length<=180&&
  /^(?:worker|lib|scripts\/pc-writer)\/[A-Za-z0-9_.\/-]+$/.test(x)&&
  !x.includes('..')&&!x.includes('\\')&&approvedDirtyNames.has(x)?
  x:'OTHER_RELEVANT_DIRTY';
 const dirty=(Array.isArray(raw.dirtyFiles)?raw.dirtyFiles:[]).slice(0,20)
  .map(x=>({path:safePath(x.path),status:['A','M','D','T','U'].includes(x.status)?
   x.status:'UNKNOWN',fileSha256:sha64(x.fileSha256)}));
 const mismatches=(Array.isArray(raw.targetBlobMismatches)?raw.targetBlobMismatches:[])
  .slice(0,9).map(x=>({path:Object.prototype.hasOwnProperty.call(TARGET_BLOBS,x.path)&&
   x.path!=='scripts/pc-writer/release-calendar.mjs'?x.path:null,
   localBlob:sha40(x.localBlob),publicBlob:sha40(x.publicBlob)}));
 return {activeRootVerified:false,
  sourceHead:sha40(raw.sourceHead),configSource:sha40(raw.configSource),
  publicHeadPinned:raw.publicHeadPinned===true,
  publicHotfixBlobPinned:raw.publicHotfixBlobPinned===true,
  otherTargetBlobMatches:safeCount(raw.otherTargetBlobMatches),
  otherTargetBlobCount:safeCount(raw.otherTargetBlobCount),
  dirtyFiles:dirty,targetBlobMismatches:mismatches,
  relevantDirtyCount:safeCount(raw.relevantDirtyCount),
  soleExpectedHotfixDirty:raw.soleExpectedHotfixDirty===true,
  stagedIndexCount:safeCount(raw.stagedIndexCount),
  configSourceMatchesHistoric:raw.configSourceMatchesHistoric===true,
  sourceHeadMatchesHistoric:raw.sourceHeadMatchesHistoric===true};
}
export function sanitizeCycleCheckpoint(raw){
 if(!raw||typeof raw!=='object')return {exists:false,code:'CHECKPOINT_NOT_AVAILABLE'};
 if(raw.exists!==true)return {exists:false,code:['CHECKPOINT_NOT_REGULAR_OR_BOUNDED',
  'CHECKPOINT_READ_UNAVAILABLE'].includes(raw.code)?raw.code:'CHECKPOINT_NOT_AVAILABLE'};
 const int=x=>Number.isInteger(x)&&x>=-100&&x<=65535?x:null;
 const sha64=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x)?x:null;
 const phase=['AUXILIARY_INPUTS_UNCHANGED',
  'CHECKPOINT_UNAVAILABLE_OR_EARLY_NOT_VERIFIED','AUXILIARY_INPUTS_CHANGED'];
 return {exists:true,
  modifiedAt:typeof raw.modifiedAt==='string'&&
   /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw.modifiedAt)&&
   Number.isFinite(Date.parse(raw.modifiedAt))?raw.modifiedAt:null,
  checkpointSha256:sha64(raw.checkpointSha256),
  status:['PUBLICATION_NOT_VERIFIED','COMPLETE','COMPLETE_WITH_COLLECTION_GAPS']
   .includes(raw.status)?raw.status:'UNKNOWN',
  publishRequested:raw.publishRequested===true,
  publicationExit:int(raw.publicationExit),collectionExit:int(raw.collectionExit),
  collectionStatus:['COMPLETE','ERROR','FAILED','SOURCE_FAILED']
   .includes(raw.collectionStatus)?raw.collectionStatus:'UNKNOWN',
  policyPublishAllowed:raw.policyPublishAllowed===true,
  policyCollectionDegraded:raw.policyCollectionDegraded===true,
  policyInputPolicy:['NORMAL_STORED_INPUTS','VALID_STORED_INPUTS_ONLY']
   .includes(raw.policyInputPolicy)?raw.policyInputPolicy:'UNKNOWN',
  policyCollectionReason:['QUOTA_GUARD','COLLECTION_FAILED']
   .includes(raw.policyCollectionReason)?raw.policyCollectionReason:null,
  progressiveEnabled:raw.progressiveEnabled===true,
  progressiveEarlyExit:int(raw.progressiveEarlyExit),
  progressiveFinalSkipped:raw.progressiveFinalSkipped===true,
  progressiveReason:phase.includes(raw.progressiveReason)?raw.progressiveReason:'UNKNOWN'};
}
async function apiBytes(url,{fetchImpl,headers,method='GET',body}={}){
 return fetchImpl(url,{method,headers,body});
}
export async function writeOnce(remote,bytes,{fetchImpl=fetch,auth}={}){
 const url=`${API}/contents/${remote}`;
 async function readback(){
  const r=await apiBytes(`${url}?ref=${encodeURIComponent(BRANCH)}`,
   {fetchImpl,headers:auth});
  if(r.status===404)return null;
  need(r.status===200,'CAL_B_EVIDENCE_READBACK_STOP');
  const data=await r.json();
  need(data.encoding==='base64','CAL_B_EVIDENCE_ENCODING_STOP');
  return Buffer.from(data.content.replace(/\s/g,''),'base64');
 }
 const before=await readback();
 if(before){
  need(before.equals(bytes),'CAL_B_EVIDENCE_CONFLICT_STOP');
  return;
 }
 await apiBytes(url,{fetchImpl,headers:{...auth,'content-type':'application/json'},
  method:'PUT',body:JSON.stringify({branch:BRANCH,
   message:'chore(calendar): one-time private source preflight evidence',
   content:bytes.toString('base64')})});
 const after=await readback();
 need(after?.equals(bytes),'CAL_B_EVIDENCE_UNCONFIRMED_STOP');
}
export async function uploadPreflight({env=process.env,fetchImpl=fetch}={}){
 need(env.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_ACTOR==='ansqhd5774-Choi'&&
  typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>15,
  'CAL_B_UPLOAD_AUTH_STOP');
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 need(event.repository?.private===true&&event.repository?.full_name===REPO&&
  event.sender?.login===env.GITHUB_ACTOR&&event.action==='opened'&&
  event.issue?.title==='pc-calendar-source-preflight-once'&&
  event.issue?.user?.login===env.GITHUB_ACTOR,
  'CAL_B_UPLOAD_ISSUE_STOP');
 const request=JSON.parse(event.issue.body);
 need(request.schema==='ZGMINI_CALENDAR_SOURCE_PREFLIGHT_V1'&&
  /^pc-calendar-[a-f0-9-]{36}$/.test(request.requestId??''),
  'CAL_B_UPLOAD_REQUEST_STOP');
 const raw=fs.readFileSync(path.join(env.RUNNER_TEMP,'calendar-source-preflight-result.json'));
 need(raw.length>50&&raw.length<16384,'CAL_B_UPLOAD_SIZE_STOP');
 const result=JSON.parse(raw.toString('utf8'));
 need(result.schema===SCHEMA&&['CAL_B_PREFLIGHT_PASS','CAL_B_PREFLIGHT_STOP']
  .includes(result.status)&&(!result.requestId||result.requestId===request.requestId),
  'CAL_B_UPLOAD_RESULT_STOP');
 const safe={schema:SCHEMA,requestId:request.requestId,issueNumber:event.issue.number,
  status:result.status,code:result.code??null,
  ...(result.status==='CAL_B_PREFLIGHT_STOP'&&result.diagnostic?
   {diagnostic:sanitizeDiagnostic(result.diagnostic)}:{}),
  ...(result.status==='CAL_B_PREFLIGHT_STOP'&&result.candidateCheckout?
   {candidateCheckout:sanitizeCandidateCheckout(result.candidateCheckout)}:{}),
  ...(result.status==='CAL_B_PREFLIGHT_STOP'&&result.cycleCheckpoint?
   {cycleCheckpoint:sanitizeCycleCheckpoint(result.cycleCheckpoint)}:{}),
  candidateCheckoutErrorCode:typeof result.candidateCheckoutErrorCode==='string'?
   result.candidateCheckoutErrorCode.slice(0,100):null,
  ...(result.status==='CAL_B_PREFLIGHT_PASS'?{
   head:result.head,configSource:result.configSource,
   activeCoreRootVerified:result.activeCoreRootVerified,
   sourceCount:result.sourceCount,dirtyRelevantFiles:result.dirtyRelevantFiles,
   indexDirtyCount:result.indexDirtyCount,hotfixSha256:result.hotfixSha256,
   publicHotfixBlob:result.publicHotfixBlob,
   configSha256:result.configSha256,taskXmlSha256:result.taskXmlSha256,
   baseTreeSha:result.baseTreeSha,originalBranch:result.originalBranch,
  }:{}),providerCalls:0,d1Writes:0,sqliteOpened:false,
  operationalWrites:0};
 const auth=hdr(env.GITHUB_TOKEN);
 const priv=await fetchImpl(API,{headers:auth});
 need(priv.status===200&&(await priv.json()).private===true,
  'CAL_B_UPLOAD_PRIVATE_REPO_STOP');
 const branch=await fetchImpl(`${API}/git/ref/heads/${BRANCH}`,{headers:auth});
 need(branch.status===200,'CAL_B_UPLOAD_STAGE_MISSING_STOP');
 const prefix=`results/calendar-source-preflight-${request.requestId}`;
 const json=Buffer.from(JSON.stringify(safe,null,2)+'\n');
 const txt=Buffer.from([
  `schema=${SCHEMA}`,`requestId=${request.requestId}`,
  `issueNumber=${event.issue.number}`,`status=${safe.status}`,
  `code=${safe.code??'null'}`,
  `vbsCallCounts=${safe.diagnostic?.callGraph?.map(x=>x.callCount).join(',')??'none'}`,
  `vbsResolvedArguments=${safe.diagnostic?.causality?.map(x=>x.allCallArgumentsResolved).join(',')??'none'}`,
  `vbsConditional=${safe.diagnostic?.causality?.map(x=>x.branchSeen).join(',')??'none'}`,
  `candidateBlobMatches=${safe.candidateCheckout?.otherTargetBlobMatches??'unknown'}/${safe.candidateCheckout?.otherTargetBlobCount??'unknown'}`,
  `candidateRelevantDirtyCount=${safe.candidateCheckout?.relevantDirtyCount??'unknown'}`,
  `candidateDirtyPaths=${safe.candidateCheckout?.dirtyFiles?.map(x=>x.path??'REDACTED').join(',')??'none'}`,
  `targetMismatchPaths=${safe.candidateCheckout?.targetBlobMismatches?.map(x=>x.path??'REDACTED').join(',')??'none'}`,
  `corePublicationStatus=${safe.cycleCheckpoint?.status??'unknown'}`,
  `corePublicationExit=${safe.cycleCheckpoint?.publicationExit??'unknown'}`,
  `activeCoreRootVerified=${safe.activeCoreRootVerified??false}`,
  `head=${safe.head??'null'}`,`sourceCount=${safe.sourceCount??'null'}`,
  'operationalWrites=0','providerCalls=0','d1Writes=0','sqliteOpened=false',
 ].join('\n')+'\n');
 await writeOnce(`${prefix}/result.json`,json,{fetchImpl,auth});
 await writeOnce(`${prefix}/result.txt`,txt,{fetchImpl,auth});
 const comment=`<!-- zgmini-calendar-source-preflight:${request.requestId} -->
STATUS: ${safe.status}
CODE: ${safe.code??'null'}
PRIVATE_RESULT: ${prefix}/result.json
READBACK: JSON/TXT verified
PC_OPERATIONAL_WRITE: 0; PROVIDER_GET: 0; DB/D1_WRITE: 0`;
 const posted=await fetchImpl(`${API}/issues/${event.issue.number}/comments`,{
  method:'POST',headers:{...auth,'content-type':'application/json'},
  body:JSON.stringify({body:comment})});
 need(posted.status===201,'CAL_B_UPLOAD_COMMENT_UNKNOWN_STOP');
 return {status:'RESULT_READBACK_VERIFIED',issue:event.issue.number};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 uploadPreflight().then(x=>process.stdout.write(`${x.status}\n`))
  .catch(()=>{process.stderr.write('CAL_B_PREFLIGHT_UPLOAD_STOP\n');process.exitCode=1;});
}
