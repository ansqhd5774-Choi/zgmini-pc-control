// #996 original Windows installed GitHub CLI GET-only runtime binding.
// Reuses the already configured gh.exe authentication; never extracts,
// accepts, prints or persists a token, and never changes GitHub/PC state.
// This binding feeds existing consent/4-original-issue evidence readers.
// An authenticated GET is NOT an Owner C approval or permission to move E:.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const OWNER_ID=327938088;
const REPO_ID=1442936296;
const GH='C:/Program Files/GitHub CLI/gh.exe';
const NODE='E:/ZGmini/runtime/node.exe';
const BODY_MAX=8_000_000;
const ISSUE='(?:996|1217|1219|1226|1227)';
const MANIFEST='docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json';
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const error=code=>Object.assign(Error(code),{code});
const allow=endpoint=>typeof endpoint==='string'&&(
  new RegExp(`^issues/${ISSUE}$`).test(endpoint)||
  new RegExp(`^issues/${ISSUE}/comments\\?per_page=100&page=(?:[1-9]|[1-9][0-9]|100)$`).test(endpoint)||
  new RegExp(`^contents/${MANIFEST.replaceAll('.','\\.')}\\?ref=[a-f0-9]{40}$`).test(endpoint)||
  endpoint==='actions/workflows/pc-job.yml'
);

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
          allow(route.slice(`repos/${REPO}/`.length))),
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
  });
}
