// #996 original Windows 84-file Git provenance proof — OFFLINE/READ-ONLY.
// Never executes git.exe, CMD, PowerShell, an API client, or any network call.
// All 84 independently retrieved Git blob SHA1/size/SHA256 pins are sealed
// in a separate R4 manifest. Neither this library nor its caller moves any
// original Claim, Lease, Backlog or other file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ROOT='E:/ZGmini';
const SEALED_GIT_BYTES_SHA256=
  '0978bae8a0e260a65a2d690fbee21f751d06bb4bb26d55051d30d081f4619f6f';
const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const EXPECTED_COMMITS=Object.freeze({
  installed:'badad9124157879d7a645b64f2768113d632355b',
  staged:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
  maintainer:'16064e29fea0e53e7769a24d93d75b6f5292cfc0',
});
const EXPECTED_TREES=Object.freeze({
  installed:'425f27b64f3e748cfdaa71c1eaae306d4c082997',
  staged:'9170dad62a019a48e6f261694bfb0d9c59120b46',
  maintainer:'b4dd0dfb243a895acc739a8922b084384e4318f5',
});
const PINNED_HOSTS=Object.freeze({
  installed:'32403a79fb407cabe8426de7507116847178f734da68a289cc12fa8cf4ca36c9',
  staged:'9903d822bca20ae14dcf5a2f6a0d1f44869f29b3c274e9a4a2de226d401069b3',
  maintainer:'a5ed876c520a844a33bdf6cc137ac8015f686ed416aff6370389440ad6e3cba5',
});
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
const MAINT_FILES=[
  'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
  'tools/update.mjs','tools/maintenance-ancestry.vbs',
  'tools/source-bundle-register.mjs',
].sort();
const KINDS=['installed','staged','maintainer'];
const COUNTS={installed:38,staged:39,maintainer:7};
const SREL=/^(controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/;
const HEX=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const GITHEX=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const hash=b=>createHash('sha256').update(b).digest('hex');
const gitBlob=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`))
  .update(b).digest('hex');
const need=(okay,code)=>{if(!okay)throw Object.assign(Error(code),{code});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const validRel=rel=>typeof rel==='string'&&!path.isAbsolute(rel)&&
  !rel.includes('\\')&&rel.split('/').every(s=>s&&s!=='.'&&s!=='..');

function read(root,rel,directory=false){
  need(validRel(rel),'C_996_OFFLINE_PATH_INVALID');
  const parts=rel.split('/');
  let at=root;
  for(const [i,part] of [null,...parts].entries()){
    if(part!==null)at=path.join(at,part);
    const st=fs.lstatSync(at);
    need(!st.isSymbolicLink()&&
      (i===parts.length&&!directory?
        st.isFile()&&st.nlink===1&&st.size>0&&st.size<=2_000_000:
        st.isDirectory()),'C_996_OFFLINE_PATH_UNSAFE');
  }
  return directory?fs.readdirSync(at).sort():fs.readFileSync(at);
}
function json(bytes){
  let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{}
  need(value&&typeof value==='object'&&!Array.isArray(value),
    'C_996_OFFLINE_JSON_INVALID');
  return value;
}
const fail=code=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_GIT_BYTES_OFFLINE_RESULT_R4',
  status:'SOURCE_BYTES_UNVERIFIED',code,
  originalWindowsReadback:false,executionAuthorized:false,
  operationalWrites:0,workflowPuts:0,backlogWrites:0,
  issuePosts:0,pcRetries:0,
});

/** Source-only verifier. `testOnly` is restricted to a new Linux TEMP fixture. */
export function verify996OfflineGitBytesReadOnly({
  testOnly=false,root=ROOT,manifestBytes=null,
  expectedManifestSha256=null,expectedHostShas=PINNED_HOSTS,
}={}){
  // A direct module caller cannot replace the independently sealed Git bytes.
  // Only Linux synthetic fixtures may supply a different manifest digest.
  if(!testOnly&&expectedManifestSha256!==null&&
    expectedManifestSha256!==SEALED_GIT_BYTES_SHA256)
    return fail('C_996_OFFLINE_GIT_PIN_NOT_SEALED');
  if(testOnly){
    const temp=path.resolve(os.tmpdir()),at=path.resolve(root);
    if(process.platform==='win32'||typeof root!=='string'||
      !path.isAbsolute(root)||!at.startsWith(temp+path.sep)||
      !path.basename(at).startsWith('zgmini-996-test-'))
      return fail('C_996_OFFLINE_TEST_ROOT_INVALID');
  }else if(process.platform!=='win32'||process.env.GITHUB_ACTIONS||
    process.env.RUNNER_NAME||expectedHostShas!==PINNED_HOSTS||
    path.win32.normalize(root).toLowerCase()!==
      path.win32.normalize(ROOT).toLowerCase())
    return fail('C_996_OFFLINE_ORIGINAL_WINDOWS_REQUIRED');
  try{
    need(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>0&&
      manifestBytes.length<=50_000&&HEX(expectedManifestSha256)&&
      (testOnly||expectedManifestSha256===SEALED_GIT_BYTES_SHA256)&&
      hash(manifestBytes)===expectedManifestSha256,
      'C_996_OFFLINE_SEALED_MANIFEST_REQUIRED');
    const m=json(manifestBytes);
    need(m.schema==='ZGMINI_CONTROLLER_996_GIT_BYTES_OFFLINE_MANIFEST_R4'&&
      same(Object.keys(m).sort(),['schema','commits','treeShas','files'].sort())&&
      same(Object.keys(m.commits??{}).sort(),KINDS.slice().sort())&&
      same(Object.keys(m.treeShas??{}).sort(),KINDS.slice().sort())&&
      KINDS.every(k=>m.commits[k]===EXPECTED_COMMITS[k]&&
        m.treeShas[k]===EXPECTED_TREES[k])&&
      same(Object.keys(m.files??{}).sort(),KINDS.slice().sort())&&
      same(Object.keys(expectedHostShas).sort(),KINDS.slice().sort())&&
      Object.values(expectedHostShas).every(HEX),
      'C_996_OFFLINE_MANIFEST_CONTRACT_DRIFT');
    const hosts={};
    for(const kind of KINDS){
      const bytes=read(root,HOST[kind]);
      need(hash(bytes)===expectedHostShas[kind],
        'C_996_OFFLINE_HOST_SHA_DRIFT');
      hosts[kind]=json(bytes);
    }
    const snapshots=[];
    for(const kind of KINDS){
      const host=hosts[kind];
      const revision=kind==='maintainer'?'sourceSha':'controllerSourceSha';
      const mapKey=kind==='maintainer'?'files':'controllerFiles';
      const fileHashes=host[mapKey],gitFiles=m.files[kind];
      need(host[revision]===EXPECTED_COMMITS[kind]&&
        (kind!=='maintainer'||host.schema===
          'ZGMINI_PC_MAINTENANCE_INSTALL_V1')&&
        fileHashes&&typeof fileHashes==='object'&&!Array.isArray(fileHashes)&&
        gitFiles&&typeof gitFiles==='object'&&!Array.isArray(gitFiles),
        'C_996_OFFLINE_HOST_MANIFEST_INVALID');
      const names=Object.keys(fileHashes).sort();
      need(names.length===COUNTS[kind]&&
        same(names,Object.keys(gitFiles).sort())&&
        names.every(rel=>validRel(rel)&&
          (kind==='maintainer'?MAINT_FILES.includes(rel):SREL.test(rel))),
        'C_996_OFFLINE_FILE_SET_DRIFT');
      if(kind==='staged'){
        need(same(read(root,BASE.staged,true),
          ['config','controller','host.json']),
          'C_996_OFFLINE_STAGE_LAYOUT_DRIFT');
        const observed=['config','controller'].flatMap(dir=>
          read(root,BASE.staged+'/'+dir,true).map(name=>dir+'/'+name)).sort();
        need(same(observed,names),'C_996_OFFLINE_STAGE_UNLISTED_FILE');
      }
      for(const rel of names){
        const pin=gitFiles[rel],local=BASE[kind]+'/'+rel;
        need(pin&&typeof pin==='object'&&!Array.isArray(pin)&&
          same(Object.keys(pin).sort(),['sha256','gitBlobSha1','size'].sort())&&
          HEX(pin.sha256)&&GITHEX(pin.gitBlobSha1)&&
          Number.isSafeInteger(pin.size)&&pin.size>0&&pin.size<=2_000_000&&
          HEX(fileHashes[rel]),'C_996_OFFLINE_PIN_FORMAT_INVALID');
        const bytes=read(root,local),digest=hash(bytes);
        need(bytes.length===pin.size&&digest===pin.sha256&&
          digest===fileHashes[rel]&&gitBlob(bytes)===pin.gitBlobSha1,
          'C_996_OFFLINE_GIT_BLOB_OR_HOST_MISMATCH');
        snapshots.push([local,digest]);
      }
    }
    for(const [rel,digest] of snapshots)
      need(hash(read(root,rel))===digest,
        'C_996_OFFLINE_CHANGED_DURING_SCAN');
    for(const kind of KINDS)
      need(hash(read(root,HOST[kind]))===expectedHostShas[kind],
        'C_996_OFFLINE_HOST_CHANGED_DURING_SCAN');
    need(snapshots.length===84,'C_996_OFFLINE_TOTAL_NOT_VERIFIED');
    return Object.freeze({
      schema:'ZGMINI_CONTROLLER_996_GIT_BYTES_OFFLINE_RESULT_R4',
      status:'SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS',
      installed:38,staged:39,maintainer:7,total:84,
      gitBlobManifestSha256:expectedManifestSha256,
      sourceBytesSha256:hash(Buffer.from(JSON.stringify(snapshots))),
      originalWindowsReadback:!testOnly,executionAuthorized:false,
      operationalWrites:0,workflowPuts:0,backlogWrites:0,
      issuePosts:0,pcRetries:0,
    });
  }catch(e){return fail(/^C_996_OFFLINE_[A-Z0-9_]+$/.test(e?.code??'')?
    e.code:'C_996_OFFLINE_READ_UNKNOWN');}
}
