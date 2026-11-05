// Read-only KPI aggregation of bounded, private ZGMINI result JSON files.
// Observed result files do not prove population-wide absence of failures.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const SCHEMAS=new Set(['ZGMINI_PC_RESULT_V1','ZGMINI_PC_MAINTENANCE_RESULT_V1']);
const STATUSES=new Set(['PASS','FAIL','BLOCKED','UNKNOWN','STATE_UNKNOWN']);
const GENERIC_CODES=new Set(['INTERNAL_EXECUTION_ERROR','UPDATE_UNEXPECTED_FAILURE']);
const MAX_FILES=5000,MAX_BYTES=32768;
const MAX_STDIN_BYTES=4*1024*1024,MAX_ISSUES=500;
const ISSUE_RESULT_MARKER=/<!--\s*zgmini-pc-result:(\d{1,20}):(\d{1,3}):([1-6])\s*-->/;
const ISSUE_JSON_FENCE=/```json\s*([\s\S]*?)\s*```/i;
const ISO_WITH_ZONE=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/;

const unavailable=(id,reasonCode)=>({id,status:'NOT_MEASURABLE',value:null,reasonCode});
const observed=(id,value,denominator)=>({id,status:'OBSERVED_ONLY',value,denominator,unit:'RESULT_FILES'});
function percentile(sorted,fraction){
 if(sorted.length===0)return null;
 return sorted[Math.ceil(fraction*sorted.length)-1];
}

export function summarizeKpis(records,{asOf=new Date(),windowDays=30,unreadableFiles=0}={}){
 if(!Array.isArray(records)||!Number.isInteger(windowDays)||windowDays<1||windowDays>366)
  throw Object.assign(new Error('KPI_INPUT_INVALID'),{code:'KPI_INPUT_INVALID'});
 const ending=new Date(asOf);
 if(!Number.isFinite(ending.getTime()))throw Object.assign(new Error('KPI_ASOF_INVALID'),{code:'KPI_ASOF_INVALID'});
 const beginning=new Date(ending.getTime()-windowDays*86400000);
 let unsupported=0,undated=0,outsideWindow=0;
 const included=[];
 for(const item of records){
  const r=item&&typeof item==='object'&&item.report?.schema?item.report:item;
  if(!r||!SCHEMAS.has(r.schema)||!STATUSES.has(r.status)){unsupported++;continue;}
  const at=new Date(r.finishedAt??r.startedAt??null);
  if(!Number.isFinite(at.getTime())||(!r.finishedAt&&!r.startedAt)){undated++;continue;}
  if(at<beginning||at>ending){outsideWindow++;continue;}
  included.push(r);
 }
 const genericErrors=included.filter(r=>GENERIC_CODES.has(r.code)).length;
 const memoryBlocks=included.filter(r=>r.code==='RESOURCE_WAIT_MEMORY').length;
 const durations=included.map(r=>r.durationMs).filter(n=>Number.isFinite(n)&&n>=0&&n<=86400000).sort((a,b)=>a-b);
 const kpis=[
  unavailable('unrelated_file_block_count','NO_FILE_SCOPE_CAUSAL_EVIDENCE'),
  included.length>0?observed('generic_error_count',genericErrors,included.length):
   unavailable('generic_error_count','NO_DATED_RESULT_RECORDS'),
  unavailable('independent_a_unnecessary_stop_count','NO_OPERATION_DEPENDENCY_EVIDENCE'),
  unavailable('duplicate_install_count','NO_COMPLETE_INSTALL_IDEMPOTENCY_LEDGER'),
  unavailable('unapproved_operational_write_count','NO_APPROVAL_VS_RUNTIME_AUDIT'),
  durations.length>0
   ?{id:'execution_duration_ms',status:'OBSERVED_ONLY',count:durations.length,
     p50:percentile(durations,0.5),p95:percentile(durations,0.95),
     min:durations[0],max:durations[durations.length-1],unit:'MILLISECONDS'}
   :unavailable('execution_duration_ms','NO_VALID_DURATION_EVIDENCE')
 ];
 return {schema:'ZGMINI_PC_KPI_BASELINE_V1',asOf:ending.toISOString(),
  window:{from:beginning.toISOString(),to:ending.toISOString(),days:windowDays},
  coverage:{suppliedRecords:records.length,inWindowRecords:included.length,
   outsideWindowRecords:outsideWindow,undatedRecords:undated,
   unsupportedRecords:unsupported,unreadableFiles},
  kpis,
  supportingSignals:included.length>0?[observed('memory_block_count',memoryBlocks,included.length)]:[]};
}

export function readPrivateResultDirectory(directory){
 const real=fs.realpathSync(directory);
 if(!fs.statSync(real).isDirectory())throw Object.assign(new Error('KPI_RESULTS_NOT_DIRECTORY'),{code:'KPI_RESULTS_NOT_DIRECTORY'});
 const entries=fs.readdirSync(real,{withFileTypes:true});
 if(entries.length>MAX_FILES)throw Object.assign(new Error('KPI_FILE_LIMIT'),{code:'KPI_FILE_LIMIT'});
 let unreadableFiles=0;const records=[];
 for(const entry of entries){
  if(!entry.isFile()||!/^[-_a-zA-Z0-9.]+\.json$/.test(entry.name))continue;
  const file=path.join(real,entry.name);
  try{
   const stat=fs.lstatSync(file);
   if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_BYTES||stat.size<2){unreadableFiles++;continue;}
   records.push(JSON.parse(fs.readFileSync(file,'utf8')));
  }catch{unreadableFiles++;}
 }
 return {records,unreadableFiles};
}

const timestamp=value=>{
 if(typeof value!=='string'||!ISO_WITH_ZONE.test(value))return null;
 const ms=Date.parse(value);return Number.isFinite(ms)?ms:null;
};
const mean=values=>values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*1000)/1000:null;
const midpoint=values=>{
 if(!values.length)return null;
 const a=[...values].sort((x,y)=>x-y),i=Math.floor(a.length/2);
 return Math.round((a.length%2?a[i]:(a[i-1]+a[i])/2)*1000)/1000;
};
const timings=values=>({count:values.length,meanMs:mean(values),medianMs:midpoint(values),
 minMs:values.length?Math.min(...values):null,maxMs:values.length?Math.max(...values):null});

// GitHub connector output: [{issue:{issue_number,created_at,body,labels},comments:[...]}].
// No network calls; this extension never reads or writes E: or other local files.
export function summarizeGithubPcJobMetrics(rows){
 if(!Array.isArray(rows)||rows.length>MAX_ISSUES)
  throw Object.assign(new Error('KPI_GITHUB_INPUT_INVALID'),{code:'KPI_GITHUB_INPUT_INVALID'});
 const seen=new Set(),excludedReasons={},statuses={PASS:0,BLOCKED:0,FAIL:0},codes={};
 const waits=[],durations=[],intervals=[],seats=new Set();let complete=0,duplicates=0;
 const exclude=code=>{excludedReasons[code]=(excludedReasons[code]??0)+1;};
 for(const item of rows){
  const issue=item?.issue??item,number=issue?.issue_number??issue?.number;
  if(!Number.isSafeInteger(number)||number<=0){exclude('ISSUE_ID_INVALID');continue;}
  if(seen.has(number)){duplicates++;continue;}
  seen.add(number);
  if(!Array.isArray(issue.labels)||!issue.labels.some(x=>x==='pc-job'||x?.name==='pc-job')){exclude('NOT_PC_JOB');continue;}
  const created=timestamp(issue.created_at??issue.createdAt);
  if(created===null){exclude('ISSUE_CREATED_AT_MISSING');continue;}
  if(!Array.isArray(item?.comments)){exclude('COMMENTS_UNAVAILABLE');continue;}
  let id;
  try{id=JSON.parse(issue.body).requestId;}catch{exclude('REQUEST_BODY_INVALID');continue;}
  if(typeof id!=='string'||!/^pc-[a-z0-9-]{8,76}$/.test(id)){exclude('REQUEST_ID_INVALID');continue;}
  const found=[];let malformed=false;
  for(const comment of item.comments){
   if(comment?.user?.login!=='github-actions[bot]'||typeof comment.body!=='string')continue;
   const marker=comment.body.match(ISSUE_RESULT_MARKER);
   if(!marker)continue;
   const fence=comment.body.match(ISSUE_JSON_FENCE);
   if(!fence){malformed=true;continue;}
   let report;
   try{report=JSON.parse(fence[1]);}catch{malformed=true;continue;}
   if(report?.schema!=='ZGMINI_PC_RESULT_V1'||
    report.jobId!==`run-${marker[1]}-${marker[2]}-seat-${marker[3]}`||
    ![1,2,3,4,5,6].includes(report.seat)||report.seat!==Number(marker[3])||
    !['PASS','BLOCKED','FAIL'].includes(report.status)||report.requestId!==id){malformed=true;continue;}
   found.push(report);
  }
  if(malformed){exclude('RESULT_INVALID');continue;}
  if(!found.length){exclude('RESULT_UNAVAILABLE');continue;}
  if(!found.every(r=>JSON.stringify(r)===JSON.stringify(found[0]))){exclude('RESULT_AMBIGUOUS');continue;}
  const result=found[0],start=timestamp(result.startedAt),end=timestamp(result.finishedAt);
  if(start===null||end===null||start<created||end<start){exclude('RESULT_TIME_INVALID');continue;}
  const elapsed=end-start,duration=result.durationMs;
  if(duration!=null&&(!Number.isSafeInteger(duration)||duration<0||duration>86400000||Math.abs(elapsed-duration)>1500)){
   exclude('RESULT_DURATION_INVALID');continue;
  }
  complete++;statuses[result.status]++;
  const code=typeof result.code==='string'&&/^[A-Z][A-Z0-9_]{0,100}$/.test(result.code)?result.code:'CODE_UNVERIFIED';
  codes[code]=(codes[code]??0)+1;
  waits.push(start-created);durations.push(duration??elapsed);seats.add(result.seat);
  if(end>start)intervals.push([start,1],[end,-1]);
 }
 intervals.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 let active=0,peak=0;for(const [,diff]of intervals){active+=diff;peak=Math.max(peak,active);}
 return {schema:'ZGMINI_PC_GITHUB_KPI_V1',evidence:'OBSERVED_ONLY',
  coverage:{suppliedIssues:rows.length,uniqueIssues:seen.size,completeResults:complete,
   excludedIssues:Object.values(excludedReasons).reduce((a,b)=>a+b,0),excludedReasons,duplicateIssueIds:duplicates},
  statusCounts:statuses,codeCounts:codes,
  queueWait:timings(waits),execution:timings(durations),
  observedRunnerSeats:[...seats].sort((a,b)=>a-b),peakObservedConcurrency:intervals.length?peak:null,
  notMeasured:['approvalToSubmissionMs','manualInterventionRate','eDriveGrowthBytes','unobservedConcurrency'],
  githubWrites:0,pcWrites:0,eDriveWrites:0};
}

async function cliGithubStdin(){
 const chunks=[];let bytes=0;
 for await(const chunk of process.stdin){
  bytes+=chunk.length;
  if(bytes>MAX_STDIN_BYTES)throw Object.assign(new Error('KPI_STDIN_SIZE_LIMIT'),{code:'KPI_STDIN_SIZE_LIMIT'});
  chunks.push(chunk);
 }
 let rows;
 try{rows=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 catch{throw Object.assign(new Error('KPI_GITHUB_JSON_INVALID'),{code:'KPI_GITHUB_JSON_INVALID'});}
 process.stdout.write(JSON.stringify(summarizeGithubPcJobMetrics(rows))+'\n');
}

function cli(args){
 const idx=args.indexOf('--results-dir');
 if(idx<0||!args[idx+1]||args.length!==2)throw Object.assign(new Error('KPI_EXPECTS_RESULTS_DIR'),{code:'KPI_EXPECTS_RESULTS_DIR'});
 const evidence=readPrivateResultDirectory(args[idx+1]);
 process.stdout.write(JSON.stringify(summarizeKpis(evidence.records,{unreadableFiles:evidence.unreadableFiles}),null,2)+'\n');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--github-issues-stdin')await cliGithubStdin();
  else cli(args);
 }
 catch(error){process.stderr.write((/^[A-Z_]{5,80}$/.test(error?.code??'')?error.code:'KPI_EXECUTION_BLOCKED')+'\n');process.exitCode=1;}
}
