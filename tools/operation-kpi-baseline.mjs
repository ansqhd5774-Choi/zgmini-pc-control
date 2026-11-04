// Read-only KPI aggregation of bounded, private ZGMINI result JSON files.
// Observed result files do not prove population-wide absence of failures.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const SCHEMAS=new Set(['ZGMINI_PC_RESULT_V1','ZGMINI_PC_MAINTENANCE_RESULT_V1']);
const STATUSES=new Set(['PASS','FAIL','BLOCKED','UNKNOWN','STATE_UNKNOWN']);
const GENERIC_CODES=new Set(['INTERNAL_EXECUTION_ERROR','UPDATE_UNEXPECTED_FAILURE']);
const MAX_FILES=5000,MAX_BYTES=32768;

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

function cli(args){
 const idx=args.indexOf('--results-dir');
 if(idx<0||!args[idx+1]||args.length!==2)throw Object.assign(new Error('KPI_EXPECTS_RESULTS_DIR'),{code:'KPI_EXPECTS_RESULTS_DIR'});
 const evidence=readPrivateResultDirectory(args[idx+1]);
 process.stdout.write(JSON.stringify(summarizeKpis(evidence.records,{unreadableFiles:evidence.unreadableFiles}),null,2)+'\n');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{cli(process.argv.slice(2));}
 catch(error){process.stderr.write((/^[A-Z_]{5,80}$/.test(error?.code??'')?error.code:'KPI_EXECUTION_BLOCKED')+'\n');process.exitCode=1;}
}
