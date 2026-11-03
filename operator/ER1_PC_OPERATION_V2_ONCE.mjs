/**
 * LOCAL PROTOTYPE ONLY: independent ER1 B one-shot operator (NOT Core).
 * Must be invoked only by separately approved B workflow after the global
 * GitHub create-only reservation and local no-retry marker are committed.
 * Source imports are exact-SHA staged into ephemeral GitHub Actions checkout.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {runER1SavedScore} from '../../scripts/pc-writer/market-calendar-er1-saved-score.mjs';
import {
 validateV2Approval,validateV2ConfigBinding,verifyV2SourceFiles,
 inspectWranglerOAuth,verifyV2Reader,publishIndependentER1Once,
} from './ER1_B_INDEPENDENT_PUBLISHER_V2.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const PC_HOME=String.raw`E:\ZGmini\data\pc-writer`;
const REPORT=path.join(ROOT,'ER1_PC_OPERATION_RESULT.txt');
const MANIFEST=path.join(ROOT,'ER1_PC_OPERATION_APPROVAL.json');
const MARKER=String.raw`E:\ZGmini\automation\er1-one-shot\ER1_B_ONE_SHOT_ATTEMPTED.json`;
const stop=code=>{throw Object.assign(Error(code),{code})};
const errorCode=error=>/^ER1_[A-Z0-9_]+$/.test(error?.code??error?.message??'')?
 String(error?.code??error?.message):'ER1_B_V2_UNEXPECTED_STOP';

function load(file,maxBytes){
 let info;try{info=fs.lstatSync(file)}catch{stop('ER1_B_V2_REQUIRED_FILE_MISSING_STOP')}
 if(!info.isFile()||info.isSymbolicLink()||info.size<10||info.size>maxBytes)
  stop('ER1_B_V2_REQUIRED_FILE_SHAPE_STOP');
 try{return JSON.parse(fs.readFileSync(file,'utf8'))}
 catch{stop('ER1_B_V2_REQUIRED_JSON_STOP')}
}

function guardedPc(){
 if(process.platform!=='win32')stop('ER1_B_V2_WINDOWS_ONLY_STOP');
 const e=fs.realpathSync.native(String.raw`E:\ZGmini`).toLowerCase();
 for(const dir of [PC_HOME,path.join(PC_HOME,'er1-input'),
  path.join(PC_HOME,'er1-input','days')]){
  const resolved=fs.realpathSync.native(dir).toLowerCase();
  if(!resolved.startsWith(e+path.sep)||!fs.statSync(dir).isDirectory())
   stop('ER1_B_V2_PC_PATH_STOP');
 }
}

/** Trusted parent admission handoff, written only after GitHub CAS 201. */
export function verifyParentReservation({manifest,markerFile=MARKER,manifestFile=MANIFEST}={}){
 const record=load(markerFile,4096);
 const bytes=fs.readFileSync(manifestFile);
 const manifestDigest=createHash('sha256').update(bytes).digest('hex');
 if(record?.state!=='EXECUTION_STARTED_NO_AUTO_RETRY'||
   !/^pc-er1-[a-f0-9-]{36}$/.test(record.requestId??'')||
   !Number.isSafeInteger(record.issueNumber)||record.issueNumber<1||
   record.candidateSourceSha!==manifest.candidateSourceSha||
   record.approvalManifestSha256!==manifestDigest||
   record.globalReservation!=='GITHUB_CONTENTS_CREATE_ONLY_201')
  stop('ER1_B_V2_PARENT_RESERVATION_MISSING_STOP');
 return true;
}

export async function preflight({manifest,readerGate=verifyV2Reader}={}){
 validateV2Approval(manifest);
 guardedPc();
 verifyV2SourceFiles(ROOT,manifest);
 const config=load(path.join(PC_HOME,'config.json'),64_000);
 validateV2ConfigBinding(config,manifest);
 inspectWranglerOAuth(); // Expiry >= 10min, no refresh or secret output.
 if(fs.existsSync(path.join(PC_HOME,'er1-input','er1-public-display.json')))
  stop('ER1_B_V2_DERIVED_EXISTS_REVIEW_STOP');
 if(await readerGate()!==true)stop('ER1_B_V2_READER_NOT_DEPLOYED_STOP');
 return true;
}

async function main(){
 // Result file is inside the isolated Actions workspace, never operational Core.
 if(fs.existsSync(REPORT)){process.exitCode=1;return}
 fs.writeFileSync(REPORT,'STATUS=STATE_UNKNOWN\r\nCODE=ER1_B_V2_STARTED_NO_RETRY\r\n',
  {flag:'wx'});
 let phase='PREFLIGHT',status='BLOCKED',code='ER1_B_V2_NOT_EXECUTED_STOP',writes=0;
 try{
  if(process.argv.length!==2)stop('ER1_B_V2_EXTRA_ARGS_STOP');
  const manifest=load(MANIFEST,16_384);
  await preflight({manifest});
  verifyParentReservation({manifest});
  phase='SCORE';writes='UNKNOWN';
  const calculated=runER1SavedScore({pcHome:PC_HOME});
  if(calculated?.status!=='READY_ER1_PC_DERIVED')
   stop('ER1_B_V2_SAVED_SCORE_UNVERIFIED_STOP');
  phase='D1';
  const saved=await publishIndependentER1Once({sourceRoot:ROOT,pcHome:PC_HOME,
   manifest,globalLedgerReserved:true});
  if(!['ER1_ALREADY_PUBLISHED','ER1_D1_PUBLISHED_AND_READBACK'].includes(saved.status))
   stop('ER1_B_V2_PUBLICATION_UNVERIFIED_STOP');
  status='PASS';code=saved.status;writes=saved.dbWrites;
 }catch(error){
  code=errorCode(error);
  if(phase!=='PREFLIGHT'){status='STATE_UNKNOWN';writes='UNKNOWN'}
 }
 fs.writeFileSync(REPORT,[`STATUS=${status}`,`CODE=${code}`,`D1_WRITES=${writes}`,
  'PROVIDER_REQUESTS=0','RAW_EARNINGS_EXPORTED=NO',
  'RETRY=NEVER_INSPECT_SAVED_DATA_AND_D1'].join('\r\n')+'\r\n');
 if(status!=='PASS')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await main();
