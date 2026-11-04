// Fixed, no-write public verification for the 19 collected inflation research rows.
// No provider requests or PC/D1 mutations. No payload values/tokens in issue report.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const TITLE='pc-inflation19-public-runtime-readonly-once';
export const SCHEMA='ZGMINI_INFL19_PUBLIC_RUNTIME_VERIFY_V1';
export const EXPECTED_SOURCE='INFL19_PRESENTATION_3a974384f3772b194849f6632c04b01ef5c1086702a0ed610b552d02cb213cf9';
const IDS=['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'];
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const REQ=new RegExp('^pc-infl19-public-check-'+UUID+'$');
const CHAT=new RegExp('^chat-'+UUID+'$');
const stop=code=>{throw Error(code)};
const code=e=>/^(?:INFL19_|PUBLIC_)[A-Z0-9_]{2,70}$/.test(e?.message??'')?e.message:'INFL19_PUBLIC_VERIFY_UNKNOWN';
const resultFile=n=>'INFL19_PUBLIC_VERIFY_'+n+'.json';
const read=file=>{const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size<1||s.size>150000)stop('INFL19_REPORT_INPUT_DENIED');return fs.readFileSync(file,'utf8')};
export function validate(event,env){
 if(process.platform!=='win32'||env.GITHUB_REPOSITORY!==REPO||
  env.GITHUB_ACTOR!=='ansqhd5774-Choi'||env.GITHUB_EVENT_NAME!=='issues'||
  env.GITHUB_EVENT_ACTION!=='opened'||env.GITHUB_RUN_ATTEMPT!=='1'||
  event?.repository?.private!==true||event?.repository?.full_name!==REPO||
  event.action!=='opened'||event.issue?.user?.login!=='ansqhd5774-Choi'||
  event.issue?.title!==TITLE||!Number.isSafeInteger(event.issue.number))
  stop('INFL19_PUBLIC_REQUEST_ORIGIN_DENIED');
 let r;try{r=JSON.parse(event.issue.body)}catch{stop('INFL19_PUBLIC_REQUEST_JSON_DENIED')}
 if(!r||Array.isArray(r)||Object.keys(r).sort().join('|')!==['schema','operation','requestId','chatId'].sort().join('|')||
  r.schema!==SCHEMA||r.operation!=='public-api-and-page-readonly-once'||
  !REQ.test(r.requestId)||!CHAT.test(r.chatId)||
  r.requestId.slice('pc-infl19-public-check-'.length)!==r.chatId.slice('chat-'.length))
  stop('INFL19_PUBLIC_REQUEST_CONTRACT_DENIED');
 return r;
}
export async function readLimitedBody(response,max,label){
 const expected=Number(response.headers.get('content-length'));
 const reject=()=>stop('INFL19_PUBLIC_'+label+'_BODY_LIMIT');
 if(Number.isFinite(expected)&&expected>max)reject();
 const reader=response.body?.getReader?.();
 if(!reader){const data=Buffer.from(await response.arrayBuffer());if(data.length>max)reject();return data.toString('utf8');}
 const parts=[];let size=0;
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>max){await reader.cancel();reject()}
   parts.push(Buffer.from(value));
  }
 }finally{reader.releaseLock()}
 return Buffer.concat(parts,size).toString('utf8');
}
async function getFixed(pathname,{max=130000,html=false,label='UNKNOWN'}={}){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),20000);
 try{
  const url='https://zgmini.kr'+pathname;
  const r=await fetch(url,{method:'GET',redirect:'manual',signal:ctrl.signal,
   headers:{accept:html?'text/html':'application/json'},cache:'no-store'});
  if(r.status!==200)stop('INFL19_PUBLIC_'+label+'_HTTP_NOT_200');
  const contentType=r.headers.get('content-type')??'';
  if(!contentType.includes(html?'text/html':'application/json'))
   stop('INFL19_PUBLIC_'+label+'_CONTENT_TYPE_INVALID');
  const body=await readLimitedBody(r,max,label);
  return {body,status:r.status,cache:r.headers.get('cf-cache-status')??null};
 }catch(e){
  if(/^(?:INFL19_|PUBLIC_)/.test(e?.message??''))throw e;
  stop('INFL19_PUBLIC_'+label+'_NETWORK_UNAVAILABLE');
 }finally{clearTimeout(timer)}
}
export function inspectResults(summary,market,html){
 if(summary?.schemaVersion!=='inflation-causal-public-19-r1-v1'||
  summary?.sourceVersion!==EXPECTED_SOURCE||summary?.status!=='READY'||
  summary?.score!==null||!Array.isArray(summary.indicators)||
  summary.indicators.length!==19||
  summary.indicators.some((r,i)=>r?.id!==IDS[i]||r?.status!=='READY'||
   typeof r.value!=='number'||!Number.isFinite(r.value)||!r.observationDate||
   !Number.isFinite(r.previousValue)||!Array.isArray(r.history)))
  stop('INFL19_PUBLIC_GET_19_NOT_READY');
 const inflation=market?.domains?.find(x=>x?.id==='inflation');
 if(!inflation||!Array.isArray(inflation.indicators)||inflation.indicators.length!==4)
  stop('INFL19_PUBLIC_EXISTING_FOUR_NOT_VERIFIED');
 const htmlTitle=html.includes('물가 관련 지표 (원자료 19개');
 const htmlSection=html.includes('ECONOMIC INDICATORS');
 const inlineStart=html.indexOf('수집 원자료 19개');
 const firstResearch=html.indexOf('data-research-input="research-1"');
 const lastResearch=html.indexOf('data-research-input="research-31"');
 const criterionPresent=html.includes('원유 가격이 상승하면 에너지 원가 압력이 커질 수 있음');
 const columnLabels=['>기준</th>','>이전</th>','>현재</th>'].every(label=>html.includes(label));
 const inline=htmlTitle&&htmlSection&&inlineStart>=0&&firstResearch>inlineStart&&lastResearch>firstResearch&&criterionPresent&&columnLabels;
 return {status:inline?'PASS':'PARTIAL',
  code:inline?'INFL19_PUBLIC_INLINE_19_AND_FOUR_API_VERIFIED':'INFL19_PUBLIC_INLINE_RESEARCH_NOT_VERIFIED',
  ready:summary.indicators.length,existingScoreRows:inflation.indicators.length,
  sourceVersion:summary.sourceVersion,publicHtmlResearchTitle:htmlTitle,
  publicHtmlExistingSection:htmlSection,publicHtmlInlineResearch:inline,
  publicHtmlCriterion:criterionPresent,publicHtmlColumnLabels:columnLabels};
}
export async function execute(env=process.env){
 let result={schema:SCHEMA,status:'BLOCKED',code:'INFL19_PUBLIC_NOT_STARTED',ready:null,
  existingScoreRows:null,sourceVersion:null,publicHtmlResearchTitle:false,
  publicHtmlExistingSection:false,publicHtmlInlineResearch:false,
  publicHtmlCriterion:false,publicHtmlColumnLabels:false,providerCalls:0,dbWrites:0,coreWrites:0,d1Writes:0};
 let issue;
 try{
  const event=JSON.parse(read(env.GITHUB_EVENT_PATH)),req=validate(event,env);
  issue=event.issue.number;
  result={...result,issueNumber:issue,requestId:req.requestId,runId:String(env.GITHUB_RUN_ID??'')};
  const [a,b,c]=await Promise.all([
   getFixed('/api/inflation-causal-inputs',{max:524288,label:'INPUTS'}),
   getFixed('/api/market-score',{max:3145728,label:'SCORE'}),
   getFixed('/economic-indicators/inflation/',{max:10485760,html:true,label:'HTML'}),
  ]);
  let summary,market;
  try{summary=JSON.parse(a.body);market=JSON.parse(b.body)}
  catch{stop('INFL19_PUBLIC_JSON_INVALID')}
  result={...result,...inspectResults(summary,market,c.body)};
 }catch(e){result={...result,status:'BLOCKED',code:code(e)}}
 if(issue){try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,resultFile(issue)),JSON.stringify(result)+'\n',{flag:'wx'})}
  catch{result.status='STATE_UNKNOWN';result.code='INFL19_PUBLIC_RESULT_SAVE_UNKNOWN';}}
 console.log('STATUS='+result.status+' CODE='+result.code+' READY='+result.ready);
 if(result.status!=='PASS')process.exitCode=1;
}
export async function upload(env=process.env,fetcher=fetch){
 const event=JSON.parse(read(env.GITHUB_EVENT_PATH)),req=validate(event,env);
 const result=JSON.parse(read(path.join(env.GITHUB_WORKSPACE,resultFile(event.issue.number))));
 if(!env.GITHUB_TOKEN||result.schema!==SCHEMA||
  result.issueNumber!==event.issue.number||result.requestId!==req.requestId||
  result.runId!==String(env.GITHUB_RUN_ID??'')||
  !['PASS','BLOCKED','PARTIAL','STATE_UNKNOWN'].includes(result.status))
  stop('INFL19_PUBLIC_REPORT_NOT_TRUSTED');
 const response=await fetcher('https://api.github.com/repos/'+REPO+'/issues/'+event.issue.number+'/comments',{
  method:'POST',headers:{accept:'application/vnd.github+json',
   authorization:'Bearer '+env.GITHUB_TOKEN,'content-type':'application/json'},
  body:JSON.stringify({body:'Inflation public API and page readonly: **'+result.status+'** ('+result.code+')\n\n```json\n'+JSON.stringify(result,null,2)+'\n```'})});
 if(!response.ok)stop('INFL19_PUBLIC_COMMENT_FAILED');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--upload'&&process.argv.length===3)await upload();
 else if(process.argv.length===2)await execute();
 else stop('INFL19_PUBLIC_INVALID_ARGUMENTS');
}
