// #996 independent 84-file Git source byte preflight. READ-ONLY LIBRARY ONLY.
// No CLI/CMD, C authorization, archive, claim reservation or Issue requests.
// This never uses the old interrupted C owner PID/nonce as the new owner.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const ROOT='E:/ZGmini';
const GIT_ROOT='E:/ZGmini/projects/zgmini-pc-control';
const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const CORE='badad9124157879d7a645b64f2768113d632355b';
const STAGE='9db6fff689c488a59fe8771f013b7c5d3bafc0a8';
const MAINT='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const GIT_COMMITS=new Set([CORE,STAGE,MAINT]);
const MAINT_FILES=[
  'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
  'tools/update.mjs','tools/maintenance-ancestry.vbs',
  'tools/source-bundle-register.mjs',
];
const PINNED={
  installed:'32403a79fb407cabe8426de7507116847178f734da68a289cc12fa8cf4ca36c9',
  staged:'9903d822bca20ae14dcf5a2f6a0d1f44869f29b3c274e9a4a2de226d401069b3',
  maintainer:'a5ed876c520a844a33bdf6cc137ac8015f686ed416aff6370389440ad6e3cba5',
};
const HOST={
  installed:'automation/pc-control/host.json',
  staged:`automation/pc-control/backups/controller-update-${REQ}/stage/host.json`,
  maintainer:'automation/pc-maintenance/MAINTENANCE_INSTALL.json',
};
const BASE={
  installed:'automation/pc-control',
  staged:`automation/pc-control/backups/controller-update-${REQ}/stage`,
  maintainer:'automation/pc-maintenance',
};
const SREL=/^(controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const validRel=x=>typeof x==='string'&&!path.isAbsolute(x)&&
  !x.includes('\\')&&x.split('/').every(p=>p&&p!=='.'&&p!=='..');
const sorted=a=>a.slice().sort();

// Immutable local Git object read, not network HEAD or an unpinned branch.
function gitCommittedBytes(commit,rel){
  need(GIT_COMMITS.has(commit)&&
    (SREL.test(rel)||MAINT_FILES.includes(rel)),
  'C_996_GIT_OBJECT_ARGUMENT_UNSAFE');
  return execFileSync('git',['show',`${commit}:${rel}`],{
    cwd:GIT_ROOT,windowsHide:true,timeout:30_000,maxBuffer:2_000_000});
}
function read(root,rel,directory=false){
  need(validRel(rel),'C_996_SOURCE_PATH_INVALID');
  let at=root;
  const parts=rel.split('/');
  for(const [i,part] of [null,...parts].entries()){
    if(part!==null)at=path.join(at,part);
    const st=fs.lstatSync(at);
    need(!st.isSymbolicLink()&&
      (i===parts.length&&!directory?
        st.isFile()&&st.nlink===1&&st.size>0&&st.size<=2_000_000:
        st.isDirectory()),'C_996_SOURCE_PATH_UNSAFE');
  }
  return directory?sorted(fs.readdirSync(at)):fs.readFileSync(at);
}
const parse=b=>{
  let out;try{out=JSON.parse(b.toString('utf8'));}catch{}
  need(out&&typeof out==='object'&&!Array.isArray(out),
    'C_996_SOURCE_MANIFEST_JSON_INVALID');
  return out;
};
const fail=code=>Object.freeze({schema:'ZGMINI_CONTROLLER_996_GIT_SOURCE_READONLY_V1',
  status:'SOURCE_BYTES_UNVERIFIED',code,executionAuthorized:false,
  operationalWrites:0,workflowPuts:0,issuePosts:0,pcRetries:0});

/** Fixed original Windows root; test injection allowed only in fresh temp fixture. */
export function verify996GitSourceReadOnly({testOnly=false,root=ROOT,
  expected=PINNED,gitSourceRead=gitCommittedBytes}={}){
  if(!testOnly&&!(process.platform==='win32'&&
    !process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME&&
    path.win32.normalize(root).toLowerCase()===
      path.win32.normalize(ROOT).toLowerCase()&&
    expected===PINNED&&gitSourceRead===gitCommittedBytes))
    return fail('C_996_SOURCE_ORIGINAL_WINDOWS_REQUIRED');
  try{
    if(testOnly)need(process.platform!=='win32'&&
      typeof root==='string'&&path.isAbsolute(root)&&
      path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&
      path.basename(root).startsWith('zgmini-996-test-')&&
      expected!==PINNED&&gitSourceRead!==gitCommittedBytes,
      'C_996_SOURCE_TEST_ROOT_INVALID');
    need(expected&&Object.keys(expected).length===3&&
      Object.values(expected).every(hex)&&
      typeof gitSourceRead==='function',
      'C_996_SOURCE_READER_INVALID');
    const host={};
    for(const k of Object.keys(HOST)){
      const bytes=read(root,HOST[k]);
      need(sha(bytes)===expected[k],
        'C_996_SOURCE_HOST_SHA_DRIFT');
      host[k]=parse(bytes);
    }
    const checks=[
      ['installed',CORE,38,'controllerFiles','controllerSourceSha'],
      ['staged',STAGE,39,'controllerFiles','controllerSourceSha'],
      ['maintainer',MAINT,7,'files','sourceSha'],
    ];
    const snapshot=[];
    const gitCache=new Map();
    for(const [kind,commit,count,key,revision] of checks){
      const manifest=host[kind];
      const map=manifest[key];
      const names=map&&typeof map==='object'&&!Array.isArray(map)?
        sorted(Object.keys(map)):[];
      need(manifest[revision]===commit&&names.length===count&&
        names.every(rel=>(kind==='maintainer'?
          MAINT_FILES.includes(rel):SREL.test(rel))&&hex(map[rel]))&&
        (kind!=='maintainer'||manifest.schema===
          'ZGMINI_PC_MAINTENANCE_INSTALL_V1'&&
          JSON.stringify(names)===JSON.stringify(sorted(MAINT_FILES))),
        'C_996_SOURCE_MANIFEST_SET_INVALID');
      if(kind==='staged'){
        need(JSON.stringify(read(root,BASE.staged,true))===
          JSON.stringify(['config','controller','host.json']),
        'C_996_SOURCE_STAGE_LAYOUT_DRIFT');
        const observed=['config','controller'].flatMap(d=>
          read(root,BASE.staged+'/'+d,true).map(x=>d+'/'+x));
        need(JSON.stringify(sorted(observed))===JSON.stringify(names),
          'C_996_SOURCE_STAGE_EXTRA_OR_MISSING');
      }
      for(const rel of names){
        const p=BASE[kind]+'/'+rel;
        const actual=read(root,p);
        need(sha(actual)===map[rel],'C_996_SOURCE_FILE_SHA_DRIFT');
        const original=gitSourceRead(commit,rel);
        need(Buffer.isBuffer(original)&&original.length>0&&
          original.length<=2_000_000&&actual.equals(original),
          'C_996_SOURCE_GIT_BYTES_DRIFT');
        gitCache.set(commit+':'+rel,Buffer.from(original));
        snapshot.push([p,sha(actual)]);
      }
    }
    // A second scan detects ordinary concurrent modifications during Git reads.
    for(const [p,digest] of snapshot)
      need(sha(read(root,p))===digest,'C_996_SOURCE_CHANGED_DURING_SCAN');
    for(const k of Object.keys(HOST))
      need(sha(read(root,HOST[k]))===expected[k],
      'C_996_SOURCE_MANIFEST_CHANGED_DURING_SCAN');
    need(gitCache.size===84&&snapshot.length===84,
      'C_996_SOURCE_TOTAL_NOT_VERIFIED');
    return Object.freeze({schema:'ZGMINI_CONTROLLER_996_GIT_SOURCE_READONLY_V1',
      status:'SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS',
      installed:38,staged:39,maintainer:7,total:84,
      sourceBytesSha256:sha(Buffer.from(JSON.stringify(snapshot))),
      executionAuthorized:false,operationalWrites:0,workflowPuts:0,
      issuePosts:0,pcRetries:0});
  }catch(e){return fail(/^C_996_[A-Z0-9_]+$/.test(e?.code??'')?
    e.code:'C_996_SOURCE_READ_UNKNOWN');}
}
