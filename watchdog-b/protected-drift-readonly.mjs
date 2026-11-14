// One exact first-fail diagnostic for Watchdog B #1372. Reads only the
// installed historical protection snapshot and the already existing fixed
// protection() read API. Never modifies baseline, Watchdog, Tasks or DB.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {protection} from '../tools/install-runner-watchdog.mjs';
import {REPO,exact,error} from './contract.mjs';
const home='E:/ZGmini/automation/pc-watchdog';
const sha=x=>createHash('sha256').update(x).digest('hex');
const labels=Object.freeze({
 'ZGMINI-PC-Local-Core':'CORE_TASK_XML',
 'ZGMINI-PC-Local-Korea':'KOREA_TASK_XML',
 'ZGMINI-PC-Iran-Progress-R13':'RETIRED_IRAN_TASK',
 'E:/ZGmini/data/pc-writer/config.json':'WRITER_CONFIG',
 'E:/ZGmini/data/pc-writer/quota-runner.cmd':'WRITER_QUOTA_RUNNER',
 'E:/ZGmini/data/pc-writer/run-local.cmd':'WRITER_RUN_LOCAL',
 'E:/ZGmini/automation/pc-control/host.json':'CONTROLLER_HOST'
});
const requestSchema='ZGMINI_PC_WATCHDOG_PROTECTED_DRIFT_A_REQUEST_V1';
const responseSchema='ZGMINI_PC_WATCHDOG_PROTECTED_DRIFT_A_RESULT_V1';
const title='pc-watchdog-protected-drift-readonly';
const operation='watchdog-protected-drift-readonly';
const requestIdPattern=/^pc-watchdog-a-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function reportCode(code){return /^[A-Z][A-Z0-9_]{2,90}$/.test(String(code??''))
 ?code:'WATCHDOG_A_READ_UNCLASSIFIED';}
export function protectedKeyDelta(before,now){
 if(!before||typeof before!=='object'||Array.isArray(before)
   ||!now||typeof now!=='object'||Array.isArray(now))
  throw error('WATCHDOG_A_PROTECTION_SCHEMA_INVALID');
 const union=new Set([...Object.keys(before),...Object.keys(now)]);
 if([...union].some(key=>!Object.hasOwn(labels,key)))
  throw error('WATCHDOG_A_PROTECTION_UNKNOWN_FIELD');
 return [...union].filter(key=>before[key]!==now[key])
   .map(key=>({category:labels[key],
     change:!Object.hasOwn(before,key)?'ADDED'
       :!Object.hasOwn(now,key)?'MISSING':'CHANGED'}))
   .sort((a,b)=>a.category.localeCompare(b.category));
}
export function approveReadonly(event,body){
 if(event?.repository?.full_name!==REPO||event.repository.private!==true
   ||event.action!=='opened'||event.sender?.login!=='ansqhd5774-Choi'
   ||event.issue?.user?.login!=='ansqhd5774-Choi'
   ||event.issue?.title!==title||!Array.isArray(event.issue.labels)
   ||!event.issue.labels.some(label=>label?.name==='pc-maintenance'))
   throw error('WATCHDOG_A_EVENT_DENIED');
 if(!exact(body,['schema','requestId','operation','failedIssueNumber'])
   ||body.schema!==requestSchema||body.operation!==operation
   ||!requestIdPattern.test(body.requestId??'')
   ||body.failedIssueNumber!==1372)
   throw error('WATCHDOG_A_REQUEST_INVALID');
 return body;
}
function createOnly(rel,bytes,gh){
 const record={message:'watchdog protection first-fail readonly '+rel,
   content:bytes.toString('base64'),branch:'main'};
 const tmp=path.join(process.env.RUNNER_TEMP,'watchdog-a-'+sha(rel).slice(0,12)+'.json');
 fs.writeFileSync(tmp,JSON.stringify(record),{flag:'wx'});
 try{
  gh(['api','repos/'+REPO+'/contents/'+rel,'--method','PUT','--input',tmp]);
  const current=JSON.parse(gh(['api','repos/'+REPO+'/contents/'+rel+'?ref=main']));
  if(current.encoding!=='base64'
   ||sha(Buffer.from(current.content.replace(/\s/g,''),'base64'))!==sha(bytes))
    throw error('WATCHDOG_A_REMOTE_READBACK_MISMATCH');
 }finally{try{fs.unlinkSync(tmp);}catch{}}
}
export function main(){
 if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true'
   ||!process.env.RUNNER_NAME||process.env.GITHUB_RUN_ATTEMPT!=='1'
   ||!process.env.GITHUB_TOKEN||!process.env.RUNNER_TEMP)
   throw error('WATCHDOG_A_RUNNER_ENV_DENIED');
 const event=readJSON(process.env.GITHUB_EVENT_PATH);
 let body;try{body=JSON.parse(event.issue.body);}catch{throw error('WATCHDOG_A_BODY_JSON_INVALID');}
 if(event.issue.body.trim()!==JSON.stringify(body))
  throw error('WATCHDOG_A_BODY_NONCANONICAL');
 const request=approveReadonly(event,body);
 let result={schema:responseSchema,requestId:request.requestId,
   failedIssueNumber:1372,status:'STATE_UNKNOWN',code:'WATCHDOG_A_READ_NOT_RUN',
   changed:[],writes:0,providerCalls:0,d1Writes:0,
   runId:process.env.GITHUB_RUN_ID??null};
 try{
  const before=readJSON(path.join(home,'PROTECTION_BEFORE.json'));
  const current=protection();
  const changed=protectedKeyDelta(before,current);
  result={...result,status:'PASS',code:changed.length
    ?'WATCHDOG_A_PROTECTED_KEYS_CHANGED':'WATCHDOG_A_NO_PROTECTED_KEYS_CHANGED',
    changed,changedCount:changed.length};
 }catch(e){result={...result,status:'BLOCKED',code:reportCode(e.code??e.message)};}
 const ghbin='C:/Program Files/GitHub CLI/gh.exe';
 const gh=args=>execFileSync(ghbin,args,{encoding:'utf8',windowsHide:true,
   timeout:30000,maxBuffer:120000,
   env:{...process.env,GH_TOKEN:process.env.GITHUB_TOKEN}});
 const stem='results/watchdog-a-'+request.requestId;
 createOnly(stem+'.json',Buffer.from(JSON.stringify(result,null,2)+'\n'),gh);
 const txt=['schema='+responseSchema,'requestId='+request.requestId,
   'status='+result.status,'code='+result.code,
   'changedCategories='+result.changed.map(x=>x.category+':'+x.change).join(','),
   'writes=0','rawValuesExposed=NO',''].join('\r\n');
 createOnly(stem+'.txt',Buffer.from(txt),gh);
 gh(['issue','comment',String(event.issue.number),'--repo',REPO,'--body',
   'Watchdog #1372 first-fail targeted readback: '+result.code+
   '\nChanged protected categories: '+result.changed.map(x=>x.category+':'+x.change).join(',')+
   '\nJSON/TXT: '+stem+'.json / '+stem+'.txt'+
   '\nNo protected baseline was modified. No B request was retried.']);
 console.log(JSON.stringify({status:result.status,code:result.code,changed:result.changed}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
 try{main();}
 catch(e){console.log(JSON.stringify({status:'BLOCKED',code:reportCode(e.code??e.message)}));process.exitCode=1;}
}
