// Source-only, READ-ONLY proof of Writer B's S0 -> prepared P local overlay.
// This never creates a grant, authorizes the R6 B effect, or accepts authority
// from Issue text/environment. The *trusted host* must independently bind all
// reviewer pins, the Writer B manifest digest and the installed source root.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifyR6OneShotApprovalBytes} from './contract.mjs';

export const R6_PREPARED_PROOF_SCHEMA='ZGMINI_R6_B_PREPARED_SOURCE_READONLY_PROOF_V1';
export const R6_APPROVED_BASE=String.raw`E:\ZGmini\data\pc-writer`;
const SOURCE_BASE=String.raw`E:\ZGmini\projects`;
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PROVENANCE_KEYS=['schema','mode','localOnly','requestId','manifestSha',
  'baseHead','baseTreeOid','candidateSourceSha','preparedLocalSha',
  'preparedTreeOid','localRef','changedPaths','fileHashes'];
const HASH_KEYS=['path','change','beforeSha256','afterSha256'];
const fail=code=>{const error=Error(`R6_B_PREPARED_${code}`);error.code=error.message;throw error;};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const same=(a,b,platform)=>platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;

function verifyRoot(io,root,expected,platform) {
  if(typeof root!=='string'||!path.isAbsolute(root))fail('ROOT_INVALID');
  if(platform==='win32'&&(!same(path.win32.normalize(root),path.win32.normalize(expected),platform)))
    fail('ROOT_NOT_APPROVED');
  try {
    const stat=io.lstatSync(root);
    if(!stat.isDirectory()||stat.isSymbolicLink())fail('ROOT_ALIAS_STOP');
    const real=io.realpathSync.native(root);
    if(!same(real,root,platform))fail('ROOT_ALIAS_STOP');
    return real;
  }catch(error){if(error?.code?.startsWith('R6_B_'))throw error;fail('ROOT_UNAVAILABLE');}
}

function secureRead(io,root,components,max,platform) {
  if(!Array.isArray(components)||components.length===0||
    components.some(part=>typeof part!=='string'||!part||part==='.'||part==='..'||
      /[\\/\0]/.test(part)))fail('PATH_INVALID');
  let cursor=root;
  try {
    for(const segment of components.slice(0,-1)) {
      cursor=path.join(cursor,segment);
      const stat=io.lstatSync(cursor);
      if(!stat.isDirectory()||stat.isSymbolicLink())fail('PATH_ALIAS_STOP');
      if(!same(io.realpathSync.native(cursor),cursor,platform))fail('PATH_ALIAS_STOP');
    }
    cursor=path.join(cursor,components.at(-1));
    const stat=io.lstatSync(cursor);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size<=0||stat.size>max)
      fail('FILE_SHAPE_STOP');
    if(!same(io.realpathSync.native(cursor),cursor,platform))fail('PATH_ALIAS_STOP');
    const bytes=io.readFileSync(cursor);
    if(!(bytes instanceof Uint8Array)||bytes.byteLength===0||bytes.byteLength>max)
      fail('FILE_READ_STOP');
    return bytes;
  }catch(error){if(error?.code?.startsWith('R6_B_'))throw error;fail('FILE_UNAVAILABLE');}
}

function parse(bytes) {
  try{return JSON.parse(Buffer.from(bytes).toString('utf8'));}
  catch{fail('JSON_INVALID');}
}

function verifyProvenance(record,{requestId,sourceSha,preparedSha,writerBManifestSha256}) {
  if(!exact(record,PROVENANCE_KEYS)||
    record.schema!=='ZGMINI_PC_WRITER_B_LOCAL_OVERLAY_PROVENANCE_V1'||
    record.mode!=='LOCAL_OVERLAY'||record.localOnly!==true||
    record.requestId!==requestId||record.manifestSha!==writerBManifestSha256||
    record.candidateSourceSha!==sourceSha||record.preparedLocalSha!==preparedSha||
    record.localRef!==`refs/heads/writer-b/${requestId}`||
    !SHA40.test(record.baseHead)||!SHA40.test(record.baseTreeOid)||
    !SHA40.test(record.preparedTreeOid)||
    !Array.isArray(record.changedPaths)||!Array.isArray(record.fileHashes)||
    record.changedPaths.length!==record.fileHashes.length||
    record.changedPaths.length===0||new Set(record.changedPaths).size!==record.changedPaths.length)
    fail('PROVENANCE_CONTRACT_STOP');
  for(let i=0;i<record.fileHashes.length;i++) {
    const item=record.fileHashes[i];
    if(!exact(item,HASH_KEYS)||item.path!==record.changedPaths[i]||
      typeof item.path!=='string'||path.posix.isAbsolute(item.path)||
      item.path.split('/').some(segment=>!segment||segment==='.'||segment==='..'||segment.includes('\\'))||
      !['add','modify','delete','ADD','MODIFY','DELETE'].includes(item.change)||
      !(item.beforeSha256===null||SHA64.test(item.beforeSha256))||
      !(item.afterSha256===null||SHA64.test(item.afterSha256)))
      fail('PROVENANCE_FILE_HASH_STOP');
  }
}

// A deliberately injectable *fixture* inspector. Even when all checks match,
// this result is information only, not a capability or an operational gate.
export function inspectR6PreparedSourceProof({pins,manifestBytes,writerBRequestId,
  expectedWriterBManifestSha256,trustedInstalledSourceRoot,
  base=R6_APPROVED_BASE,fixtureSourceBase,io=fs,gitInspect,platform=process.platform,fixture=false}={}) {
  if(platform!=='win32'&&!fixture)fail('WINDOWS_ONLY_STOP');
  if(!SHA40.test(pins?.sourceSha??'')||!SHA40.test(pins?.controlSha??'')||
    !SHA64.test(pins?.approvalManifestSha256??'')||!UUID.test(writerBRequestId??'')||
    !SHA64.test(expectedWriterBManifestSha256??''))fail('TRUST_INPUT_STOP');
  // Caller-supplied pins are only meaningful after C1 review elsewhere.
  // Exact 18-key approval and original bytes must both match H/S/M here.
  verifyR6OneShotApprovalBytes(manifestBytes,pins);
  const realBase=verifyRoot(io,base,R6_APPROVED_BASE,platform);
  const config=parse(secureRead(io,realBase,['config.json'],65536,platform));
  const raw=secureRead(io,realBase,['writer-b-install-once',writerBRequestId,'provenance.json'],65536,platform);
  const provenance=parse(raw);
  if(!SHA40.test(provenance?.preparedLocalSha??'')||
    config?.source!==provenance.preparedLocalSha)fail('CONFIG_PREPARED_SHA_STOP');
  verifyProvenance(provenance,{requestId:writerBRequestId,sourceSha:pins.sourceSha,
    preparedSha:config.source,writerBManifestSha256:expectedWriterBManifestSha256});
  if(typeof trustedInstalledSourceRoot!=='string'||!path.isAbsolute(trustedInstalledSourceRoot))
    fail('INSTALLED_SOURCE_UNBOUND');
  let rootReal;
  try {
    const sourceBaseReal=verifyRoot(io,
      fixture&&platform!=='win32'?fixtureSourceBase:SOURCE_BASE,
      SOURCE_BASE,platform);
    rootReal=io.realpathSync.native(trustedInstalledSourceRoot);
    const rel=path.relative(sourceBaseReal,rootReal);
    if(!rel||rel==='.'||rel==='..'||rel.startsWith(`..${path.sep}`)||path.isAbsolute(rel)||
      !same(rootReal,trustedInstalledSourceRoot,platform)||
      !io.lstatSync(trustedInstalledSourceRoot).isDirectory()||
      io.lstatSync(trustedInstalledSourceRoot).isSymbolicLink())
      fail('INSTALLED_SOURCE_PATH_STOP');
    let cursor=sourceBaseReal;
    for(const component of rel.split(path.sep)) {
      cursor=path.join(cursor,component);
      const stat=io.lstatSync(cursor);
      if(!stat.isDirectory()||stat.isSymbolicLink()||
        !same(io.realpathSync.native(cursor),cursor,platform))
        fail('INSTALLED_SOURCE_ALIAS_STOP');
    }
  }catch(error){if(error?.code?.startsWith('R6_B_'))throw error;fail('INSTALLED_SOURCE_UNAVAILABLE');}
  if(typeof gitInspect!=='function')fail('GIT_INSPECT_UNBOUND');
  let inspected;
  try{inspected=gitInspect(rootReal);}catch{fail('GIT_INSPECT_FAILED');}
  if(inspected?.head!==config.source||inspected?.affectedPathsClean!==true)
    fail('INSTALLED_HEAD_OR_DIRTY_STOP');
  return Object.freeze({schema:R6_PREPARED_PROOF_SCHEMA,
    status:'PREPARED_SOURCE_READONLY_VERIFIED_NOT_EXECUTABLE',
    approvedCandidateSourceSha:pins.sourceSha,installedPreparedSha:config.source,
    writerBProvenanceSha256:digest(raw),writerBRequestId,
    executable:false,allowProviderCalls:false,allowDbWrites:false});
}

function fixedGitInspect(root){
  const opts={cwd:root,encoding:'utf8',windowsHide:true,timeout:15000};
  const head=execFileSync('git',['rev-parse','HEAD'],opts).trim();
  const dirty=execFileSync('git',['status','--porcelain','--','lib','worker','scripts/pc-writer'],opts);
  return {head,affectedPathsClean:dirty.trim()===''};
}

// Production reader: no caller-supplied callback, Issue/env-sourced pin or
// fake git result. Its caller must attest each trusted argument out-of-band.
export function readR6PreparedSourceProof({pins,manifestBytes,writerBRequestId,
  expectedWriterBManifestSha256,trustedInstalledSourceRoot}={}) {
  return inspectR6PreparedSourceProof({pins,manifestBytes,writerBRequestId,
    expectedWriterBManifestSha256,trustedInstalledSourceRoot,
    platform:process.platform,io:fs,gitInspect:fixedGitInspect});
}
