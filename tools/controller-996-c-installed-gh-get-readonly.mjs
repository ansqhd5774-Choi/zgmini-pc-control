// #996 original Windows installed GitHub CLI GET-only runtime binding.
// Reuses the already configured gh.exe authentication; never extracts,
// accepts, prints or persists a token, and never changes GitHub/PC state.
// This binding feeds existing consent/4-original-issue evidence readers.
// An authenticated GET is NOT an Owner C approval or permission to move E:.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const OWNER_ID=327938088;
const REPO_ID=1442936296;
const GH='C:/Program Files/GitHub CLI/gh.exe';
const NODE='E:/ZGmini/runtime/node.exe';
const BODY_MAX=8_000_000;
const ISSUE='(?:996|1217|1219|1226|1227)';
const MANIFEST='docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json';
const ORIGINAL_PC_JOBS=Object.freeze([
  {number:1217,requestId:'pc-8da91b23-f5d6-4a94-bcd5-13b0dfcdee61',operation:'core-runtime-source-readonly'},
  {number:1219,requestId:'pc-e2710720-1a35-4a75-ab37-4940ecd33edd',operation:'core-runtime-source-readonly'},
  {number:1226,requestId:'pc-60ed9565-9b87-4099-a4d2-db9235a3cfd4',operation:'core-status'},
  {number:1227,requestId:'pc-6f7a24d4-823d-4648-b2c3-a645a352bef7',operation:'core-runtime-source-readonly'},
]);
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const error=code=>Object.assign(Error(code),{code});
const allow=endpoint=>typeof endpoint==='string'&&(
  new RegExp(`^issues/${ISSUE}$`).test(endpoint)||
  new RegExp(`^issues/${ISSUE}/comments\\?per_page=100&page=(?:[1-9]|[1-9][0-9]|100)$`).test(endpoint)||
  new RegExp(`^contents/${MANIFEST.replaceAll('.','\\.')}\\?ref=[a-f0-9]{40}$`).test(endpoint)||
  endpoint==='actions/workflows/pc-job.yml'
);
// Additional fixed GET surfaces for the #996 admission review ONLY. Never
// expose them through the general consent reader's get(endpoint) method.
const inventoryRoute=endpoint=>
  /^actions\/runners\?per_page=100&page=(?:[1-9]|1[0-9]|20)$/.test(endpoint);
const runsRoute=endpoint=>
  /^actions\/workflows\/pc-job\.yml\/runs\?status=(?:queued|in_progress|waiting)&per_page=100&page=(?:[1-9]|1[0-9]|20)$/.test(endpoint);
const ensurePage=(obj,key,page,total)=>{
  need(Number.isSafeInteger(obj?.total_count)&&obj.total_count>=0&&
    obj.total_count<=2000&&Array.isArray(obj[key])&&obj[key].length<=100&&
    (total===null||total===obj.total_count),
  'C_996_INSTALLED_GH_PAGE_INVALID');
  need(page===1||obj[key].length>0,'C_996_INSTALLED_GH_PAGE_MISSING');
  return obj.total_count;
};

function originalWindowsOnly(){
  need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
    !process.env.RUNNER_NAME&&
    path.win32.normalize(process.execPath).toLowerCase()===
      path.win32.normalize(NODE).toLowerCase()&&
    !process.env.GH_HOST,
  'C_996_INSTALLED_GH_ORIGINAL_WINDOWS_ONLY');
  const st=fs.lstatSync(GH),dir=fs.lstatSync(path.dirname(GH));
  need(st.isFile()&&!st.isSymbolicLink()&&
    dir.isDirectory()&&!dir.isSymbolicLink()&&
    path.win32.normalize(fs.realpathSync.native(GH)).toLowerCase()===
      path.win32.normalize(GH).toLowerCase(),
  'C_996_INSTALLED_GH_EXECUTABLE_UNVERIFIED');
}

/**
 * A single authenticated read session. All production calls use the fixed
 * installed gh.exe and --method GET, with no caller-controlled executable,
 * host, routes, shell, environment or network implementation.
 * Synthetic ports are available ONLY under a new Linux TEMP test directory.
 */
export function create996InstalledGhGetReadOnly({testOnly=false,
  testRoot=null,run=execFileSync}={}){
  if(testOnly){
    const temp=path.resolve(os.tmpdir());
    need(process.platform!=='win32'&&typeof testRoot==='string'&&
      path.isAbsolute(testRoot)&&
      path.resolve(testRoot).startsWith(temp+path.sep)&&
      path.basename(testRoot).startsWith('zgmini-996-test-gh-readonly-')&&
      fs.lstatSync(testRoot).isDirectory()&&
      typeof run==='function',
    'C_996_INSTALLED_GH_TEST_ROOT_INVALID');
  }else{
    need(testRoot===null&&run===execFileSync,
    'C_996_INSTALLED_GH_CUSTOM_RUNTIME_DENIED');
    originalWindowsOnly();
  }
  let checked=false,attempted=false;
  const getOnly=route=>{
    need(typeof route==='string'&&
      (/^(?:user|repos\/ansqhd5774-Choi\/zgmini-pc-control)$/.test(route)||
        route.startsWith(`repos/${REPO}/`)&&
          (allow(route.slice(`repos/${REPO}/`.length))||
            inventoryRoute(route.slice(`repos/${REPO}/`.length))||
            runsRoute(route.slice(`repos/${REPO}/`.length)))),
    'C_996_INSTALLED_GH_ROUTE_DENIED');
    let raw;
    try{
      raw=run(GH,['api','--method','GET',route],{
        encoding:'utf8',windowsHide:true,timeout:30_000,
        maxBuffer:BODY_MAX,stdio:['ignore','pipe','pipe'],
      });
    }catch{throw error('C_996_INSTALLED_GH_GET_FAILED');}
    need(typeof raw==='string'&&Buffer.byteLength(raw,'utf8')>0&&
      Buffer.byteLength(raw,'utf8')<=BODY_MAX,
    'C_996_INSTALLED_GH_RESPONSE_BOUNDS');
    let data;try{data=JSON.parse(raw);}
    catch{throw error('C_996_INSTALLED_GH_JSON_INVALID');}
    return Object.freeze({status:200,data});
  };
  const authenticate=()=>{
      need(!attempted,'C_996_INSTALLED_GH_AUTH_REUSED');
      attempted=true;
      const repo=getOnly(`repos/${REPO}`).data;
      const owner=getOnly('user').data;
      need(repo?.id===REPO_ID&&repo.full_name===REPO&&
        repo.private===true&&repo.owner?.login===OWNER&&
        repo.owner.id===OWNER_ID&&owner?.login===OWNER&&
        owner.id===OWNER_ID,
      'C_996_INSTALLED_GH_ORIGIN_UNVERIFIED');
      checked=true;
      return Object.freeze({kind:'OWNER_USER_GET',actor:OWNER,
        ownerAccountId:OWNER_ID,repository:REPO,repositoryId:REPO_ID,
        private:true,readOnly:true,executionAuthorized:false,
        testOnly:testOnly===true});
  };
  return Object.freeze({
    async authenticateReadOnly(){
      return authenticate();
    },
    async get(endpoint){
      // The workflow read is exposed only through the validated, fixed
      // readWorkflowStateReadOnly() interface, not the generic consent port.
      need(checked&&allow(endpoint)&&endpoint!=='actions/workflows/pc-job.yml',
      'C_996_INSTALLED_GH_GET_NOT_AUTHORIZED');
      return getOnly(`repos/${REPO}/${endpoint}`);
    },
    readWorkflowStateReadOnly(){
      if(!checked)authenticate();
      const value=getOnly(`repos/${REPO}/actions/workflows/pc-job.yml`).data;
      need(Number.isSafeInteger(value?.id)&&value.id>0&&
        value.path==='.github/workflows/pc-job.yml'&&
        value.state==='active',
      'C_996_INSTALLED_GH_WORKFLOW_STATE_UNVERIFIED');
      return value.state;
    },
    readPcJobRunnersReadOnly(){
      if(!checked)authenticate();
      const found=[],ids=new Set();let total=null;
      for(let page=1;page<=20;page++){
        const data=getOnly(`repos/${REPO}/actions/runners?per_page=100&page=${page}`).data;
        total=ensurePage(data,'runners',page,total);
        for(const row of data.runners){
          need(Number.isSafeInteger(row?.id)&&row.id>0&&!ids.has(row.id)&&
            typeof row.name==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(row.name)&&
            ['online','offline'].includes(row.status)&&
            typeof row.busy==='boolean'&&Array.isArray(row.labels)&&
            row.labels.length>0&&row.labels.length<=40,
          'C_996_INSTALLED_GH_RUNNER_ROW_INVALID');
          const labels=[];
          for(const item of row.labels){
            need(Number.isSafeInteger(item?.id)&&item.id>0&&
              typeof item.name==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(item.name)&&
              !labels.includes(item.name),
            'C_996_INSTALLED_GH_RUNNER_LABEL_INVALID');
            labels.push(item.name);
          }
          ids.add(row.id);found.push(Object.freeze({id:row.id,name:row.name,
            status:row.status,busy:row.busy,labels:Object.freeze(labels)}));
        }
        if(found.length===total)break;
        need(data.runners.length===100&&page<20,
          'C_996_INSTALLED_GH_RUNNER_PAGINATION_INCOMPLETE');
      }
      need(found.length===total,'C_996_INSTALLED_GH_RUNNER_PAGINATION_INCOMPLETE');
      return Object.freeze({schema:'ZGMINI_996_PC_JOB_RUNNER_GET_V1',
        status:'RUNNER_INVENTORY_GET_ONLY',totalCount:total,
        runners:Object.freeze(found),executionAuthorized:false});
    },
    readPcJobRunsReadOnly(){
      if(!checked)authenticate();
      const counts={};
      for(const status of ['queued','in_progress','waiting']){
        let total=null,collected=0;const ids=new Set();
        for(let page=1;page<=20;page++){
          const data=getOnly(`repos/${REPO}/actions/workflows/pc-job.yml/runs?status=${status}&per_page=100&page=${page}`).data;
          total=ensurePage(data,'workflow_runs',page,total);
          for(const run of data.workflow_runs){
            need(Number.isSafeInteger(run?.id)&&run.id>0&&!ids.has(run.id)&&
              run.status===status&&run.event==='issues',
            'C_996_INSTALLED_GH_WORKFLOW_RUN_INVALID');
            ids.add(run.id);collected++;
          }
          if(collected===total)break;
          need(data.workflow_runs.length===100&&page<20,
            'C_996_INSTALLED_GH_RUN_PAGINATION_INCOMPLETE');
        }
        need(collected===total,'C_996_INSTALLED_GH_RUN_PAGINATION_INCOMPLETE');
        counts[status]=total;
      }
      return Object.freeze({schema:'ZGMINI_996_PC_JOB_RUNS_GET_V1',
        status:'WORKFLOW_RUNS_GET_ONLY',counts:Object.freeze(counts),
        executionAuthorized:false});
    },
    readOriginalPcJobIssuesReadOnly(){
      if(!checked)authenticate();
      const issues=ORIGINAL_PC_JOBS.map(spec=>{
        const data=getOnly(`repos/${REPO}/issues/${spec.number}`).data;
        need(data?.number===spec.number&&Number.isSafeInteger(data.id)&&
          data.id>0&&data.user?.login===OWNER&&data.user.id===OWNER_ID&&
          ['open','closed'].includes(data.state)&&
          Array.isArray(data.labels)&&
          data.labels.some(item=>item?.name==='pc-job')&&
          Number.isSafeInteger(data.comments)&&data.comments>=0&&
          typeof data.body==='string'&&Buffer.byteLength(data.body,'utf8')<=16_384&&
          Number.isFinite(Date.parse(data.created_at))&&
          Number.isFinite(Date.parse(data.updated_at)),
        'C_996_INSTALLED_GH_ORIGINAL_ISSUE_INVALID');
        let body;try{body=JSON.parse(data.body);}
        catch{throw error('C_996_INSTALLED_GH_ORIGINAL_BODY_INVALID');}
        need(body?.schema==='ZGMINI_PC_JOB_V1'&&
          body.requestId===spec.requestId&&body.operation===spec.operation&&
          typeof body.chatId==='string'&&body.chatId.startsWith('chat-')&&
          body.sourceRepository==='ansqhd5774-Choi/zgmini'&&
          body.sourceBranch==='main'&&
          /^[a-f0-9]{40}$/.test(body.sourceSha),
        'C_996_INSTALLED_GH_ORIGINAL_BODY_INVALID');
        return Object.freeze({number:spec.number,id:data.id,requestId:spec.requestId,
          operation:spec.operation,state:data.state,
          commentCount:data.comments,createdAt:data.created_at,
          updatedAt:data.updated_at,
          bodySha256:createHash('sha256').update(data.body).digest('hex')});
      });
      return Object.freeze({schema:'ZGMINI_996_ORIGINAL_PC_JOB_GET_V1',
        status:'ORIGINAL_ISSUES_GET_ONLY',issues:Object.freeze(issues),
        // Issue state/body is not a verified C disposition or an Owner C approval.
        dispositionsVerified:false,executionAuthorized:false});
    },
  });
}
