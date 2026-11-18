// W03: inspect the exact PC R179 first-fail branch; classify code operators,
// not raw protected source/credentials, URLs, JSON rows or original file names.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const TITLE='w03-r179-guard-shape-readonly';
export const SCHEMA='ZGMINI_W03_R179_GUARD_SHAPE_A_V1';
export const OUTPUT='ZGMINI_W03_R179_GUARD_SHAPE_RESULT_V1';
export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const PIN='f9ea0a1bfaf52909b7a434b65ba93887f56660bc979a3cb7e0992597bc9f3b68';
export const PC_ROOT='E:\\ZGmini\\data\\theme-market-history-r131\\marketparquet-r167';
export const PC_SOURCE='r179-publish-core.mjs';
const OWNER='ansqhd5774-Choi';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const REAL_UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/;
const SHA=x=>createHash('sha256').update(x).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(v,code)=>{if(!v)fail(code);};
const exact=(a,keys)=>a&&typeof a==='object'&&!Array.isArray(a)&&
 Object.keys(a).length===keys.length&&keys.every(k=>Object.hasOwn(a,k));

export function authenticate(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_ACTOR===OWNER&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&
  !event.issue.pull_request&&event.issue.title===TITLE&&
  event.issue.labels?.some(x=>x.name==='pc-writer-b-install')&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'W03_R179_SHAPE_EVENT_STOP');
 let request;
 try{request=JSON.parse(event.issue.body);}catch{fail('W03_R179_SHAPE_REQUEST_JSON_STOP');}
 const keys=['schema','operation','requestId','chatId','controlRepository','controlSourceSha','r179ExpectedSha256'];
 need(exact(request,keys)&&request.schema===SCHEMA&&
  request.operation===TITLE&&request.controlRepository===REPO&&
  request.controlSourceSha===env.GITHUB_SHA&&
  request.r179ExpectedSha256===PIN&&
  REAL_UUID.test(request.requestId??'')&&REAL_UUID.test(request.chatId??''),
  'W03_R179_SHAPE_REQUEST_STOP');
 return Object.freeze(request);
}
const NAME_CLASSES=Object.freeze({
 got:'GOT',themes:'THEMES',rows:'ROWS',items:'ITEMS',
 data:'DATA',publicThemes:'PUBLIC_THEMES',
 response:'RESPONSE',result:'RESULT',payload:'PAYLOAD',
 publicResult:'PUBLIC_RESULT',
});
const VALUE_CLASSES=new Set([7,10,13,14]);
const TAGS=Object.freeze({
 'PUBLIC_API_ROLLING_MISMATCH': 'ROLLING_MISMATCH',
 'JSON.stringify':'JSON_STRINGIFY',
 'JSON.parse':'JSON_PARSE',
 'themes':'THEME_IDENTIFIER',
 'rolling':'ROLLING_IDENTIFIER',
 'observedDate':'OBSERVED_DATE_IDENTIFIER',
 'observationDate':'OBSERVATION_DATE_IDENTIFIER',
 'got':'GOT_IDENTIFIER',
 '.length':'LENGTH_ACCESS',
 'if(':'IF_BRANCH',
 'if (':'IF_BRANCH',
 'throw ':'THROW_BRANCH'
});
const cmpPattern=/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:\?\.)?\s*\.\s*length\s*(===|!==|==|!=|>=|<=|>|<)\s*(\d{1,3})\b/g;
export function classifyR179Static(bytes,expectedSha=PIN){
 need(Buffer.isBuffer(bytes)&&bytes.length===10822&&SHA(bytes)===expectedSha,
  'W03_R179_SHAPE_SOURCE_PIN_STOP');
 const src=bytes.toString('utf8');
 need(Buffer.from(src,'utf8').equals(bytes)&&!src.includes('\0'),
  'W03_R179_SHAPE_UTF8_STOP');
 const lines=src.split(/\r?\n/);
 need(lines.length>10&&lines.length<1500,'W03_R179_SHAPE_SOURCE_LINES_STOP');
 const exactOld='got.length!==7';
 const oldMatches=[];
 const comparisons=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  let start=0;
  while(true){
   const at=line.indexOf(exactOld,start);
   if(at<0)break;
   if(oldMatches.length<20)oldMatches.push({line:i+1,nearRollingMarker:false});
   start=at+exactOld.length;
  }
  let m;cmpPattern.lastIndex=0;
  while((m=cmpPattern.exec(line))!==null){
   if(comparisons.length>=60)break;
   comparisons.push({line:i+1,
    nameClass:NAME_CLASSES[m[1]]??'OTHER',
    operator:m[2],
    count:VALUE_CLASSES.has(Number(m[3]))?Number(m[3]):'OTHER',
    nearRollingMarker:false});
  }
 }
 const markerLines=lines.flatMap((line,i)=>line.includes('PUBLIC_API_ROLLING_MISMATCH')?[i+1]:[]);
 const nearby=n=>markerLines.some(m=>Math.abs(n-m)<=40);
 oldMatches.forEach(x=>{x.nearRollingMarker=nearby(x.line);});
 comparisons.forEach(x=>{x.nearRollingMarker=nearby(x.line);});
 const context=markerLines.slice(0,6).map(at=>{
  const selected=[];
  for(let n=Math.max(1,at-20);n<=Math.min(lines.length,at+20);n++){
   const line=lines[n-1];
   const marks=Object.entries(TAGS).filter(([term])=>line.includes(term)).map(([,v])=>v);
   if(marks.length)selected.push({line:n,tags:[...new Set(marks)]});
  }
  return {markerLine:at,signals:selected.slice(0,30)};
 });
 return {schema:'ZGMINI_W03_R179_GUARD_SHAPE_PAYLOAD_V1',
  result:'STATIC_SOURCE_PINNED',
  exactOldCount:src.split(exactOld).length-1,
  oldMatches,
  comparisonCount:comparisons.length,
  comparisons,rollingMarkerCount:markerLines.length,
  context,
  sourceBytes:bytes.length,sourceSha256:expectedSha,
  sourceOnly:true,providerCalls:0,sqliteOpened:false,sqliteWrites:0,
  publisherExecuted:false,pcWrites:0,d1Writes:0};
}
export function readPinnedR179Shape({read=fs.readFileSync,stat=fs.lstatSync,
 real=fs.realpathSync.native}={}){
 need(process.platform==='win32','W03_R179_SHAPE_WINDOWS_ONLY_STOP');
 const filepath=path.win32.join(PC_ROOT,PC_SOURCE);
 const info=stat(filepath);
 need(info.isFile()&&!info.isSymbolicLink()&&info.size===10822,
  'W03_R179_SHAPE_SOURCE_SIZE_STOP');
 need(path.win32.dirname(real(filepath)).toLowerCase()===real(PC_ROOT).toLowerCase(),
  'W03_R179_SHAPE_REALPATH_STOP');
 const first=read(filepath),second=read(filepath);
 need(Buffer.isBuffer(first)&&Buffer.isBuffer(second)&&first.equals(second),
  'W03_R179_SHAPE_SOURCE_CHANGED_STOP');
 return classifyR179Static(first);
}
export function execute({event,env,inspect=readPinnedR179Shape}={}){
 const req=authenticate(event,env);
 const shape=inspect();
 need(shape?.schema==='ZGMINI_W03_R179_GUARD_SHAPE_PAYLOAD_V1'&&
  shape.sourceOnly===true&&shape.pcWrites===0&&shape.d1Writes===0&&
  shape.providerCalls===0&&shape.sqliteOpened===false&&
  shape.sqliteWrites===0&&shape.publisherExecuted===false,
  'W03_R179_SHAPE_OUTPUT_STOP');
 return {schema:OUTPUT,status:'PASS',
  code:'W03_R179_GUARD_SHAPE_READONLY',
  requestId:req.requestId,controlSourceSha:env.GITHUB_SHA,
  payload:shape};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let out;
 try{out=execute({event:JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),
  env:process.env});}
 catch(e){out={schema:OUTPUT,status:'STOP',requestId:null,
  code:/^W03_R179_SHAPE_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
   e.code:'W03_R179_SHAPE_UNCLASSIFIED_STOP',payload:null};}
 try{
  need(typeof process.env.RUNNER_TEMP==='string'&&path.isAbsolute(process.env.RUNNER_TEMP),
   'W03_R179_SHAPE_TEMP_STOP');
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'w03-r179-guard-shape-result.json'),
   JSON.stringify(out)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(out.status+' '+out.code+'\n');
 if(out.status!=='PASS')process.exitCode=1;
}