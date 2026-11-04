import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Fixed, bounded PC evidence reader. No provider, database, publication or
// operational file writes. Never serialize raw prices, log lines or tokens.
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const HEX64 = /^[a-f0-9]{64}$/;
const CANDIDATE = /^THEME_NINE_R48_PRIVATE_CANDIDATE_(\d{4}-\d\d-\d\d)_([a-f0-9]{16})\.json$/;
const R51 = /^THEME_NINE_R51_[A-Z0-9_]+_(\d{4}-\d\d-\d\d)_[a-f0-9]{16}\.json$/;
const R54_LOG = /^THEME_NINE_R54_CYCLE_\d{1,8}_\d{1,8}\.txt$/;
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAX_CANDIDATE_BYTES = 4 * 1024 * 1024;
const MAX_LOG_BYTES = 1024 * 1024;
const MAX_CANDIDATES = 32;
const MAX_MANIFEST_ENTRIES = 2048;
const MAX_FILES_PER_DIRECTORY = 4096;
const MAX_LOGS = 12;
const MAX_RAW_BYTES = 32 * 1024 * 1024;

const inside = (base, file) => {
  const r=path.relative(base,file);
  return r!=='' && r!=='..' && !r.startsWith('..'+path.sep) && !path.isAbsolute(r);
};
function noRedirectedComponents(root,target) {
  let current=root;
  for(const component of path.relative(root,target).split(path.sep)){
    current=path.join(current,component);
    try { if(fs.lstatSync(current).isSymbolicLink())return false; }
    catch {return false;}
  }
  return true;
}
function fixedFile(root, relative, maximum) {
  const target=path.join(root,...relative.split('/'));
  if(!inside(root,target))return {status:'UNSAFE_PATH'};
  let st,real;
  try { st=fs.lstatSync(target);real=fs.realpathSync.native(target); }
  catch(error) { return {status:error.code==='ENOENT'?'MISSING':'UNREADABLE'}; }
  if(!st.isFile()||st.isSymbolicLink()||!inside(root,real)||!noRedirectedComponents(root,target))return {status:'UNSAFE_FILE'};
  if(st.size<2||st.size>maximum)return {status:'INVALID_SIZE'};
  try {const bytes=fs.readFileSync(target);if(bytes.length>maximum)return {status:'INVALID_SIZE'};
    return {status:'READ',bytes,modifiedAt:st.mtime.toISOString()};
  } catch {return {status:'UNREADABLE'};}
}
function fixedDirectory(root,relative) {
  const target=path.join(root,...relative.split('/'));
  try {
    const st=fs.lstatSync(target),real=fs.realpathSync.native(target);
    if(!st.isDirectory()||st.isSymbolicLink()||!inside(root,real)||!noRedirectedComponents(root,target))return {status:'UNSAFE_DIRECTORY'};
    const names=fs.readdirSync(target);
    return names.length<=MAX_FILES_PER_DIRECTORY?{status:'READY',names}: {status:'DIRECTORY_LIMIT'};
  }catch(error){return {status:error.code==='ENOENT'?'MISSING':'UNREADABLE'};}
}
function parseObject(bytes) {
  try {const o=JSON.parse(bytes.toString('utf8'));return o&&typeof o==='object'&&!Array.isArray(o)?o:null;}
  catch{return null;}
}
function manifestSnapshot(root,folder) {
  const file=fixedFile(root,`themes/${folder}/raw-manifest.json`,MAX_MANIFEST_BYTES);
  if(file.status!=='READ')return {status:file.status};
  const parsed=parseObject(file.bytes);
  if(!Array.isArray(parsed?.files)||parsed.files.length>MAX_MANIFEST_ENTRIES||parsed.files.length===0)
    return {status:'INVALID_MANIFEST'};
  if(parsed.project!==folder)return {status:'MANIFEST_IDENTITY_DRIFT'};
  return {status:'READY',hash:sha(file.bytes),modifiedAt:file.modifiedAt,parsed};
}
function verifyRawPrefix(root,folder,manifest) {
  const home=path.join(root,'themes',folder),seen=new Set();
  for(const page of manifest.files){
    if(page?.priceMode!=='RAW_UNADJUSTED_1H_NOT_OFFICIAL_CLOSE'||
       !HEX64.test(page?.sha256??'')||!/^raw\/[A-Z][A-Z0-9.]{0,11}_[a-f0-9]{64}\.jsonl$/.test(page?.path??'')||
       page.path!==`raw/${page.symbol}_${page.sha256}.jsonl`||seen.has(page.path))
      return {status:'INVALID_PAGE_REFERENCE'};
    seen.add(page.path);
    const f=fixedFile(home,page.path,MAX_RAW_BYTES);
    if(f.status!=='READ')return {status:'RAW_'+f.status};
    if(sha(f.bytes)!==page.sha256)return {status:'RAW_SHA_DRIFT'};
  }
  return {status:'RAW_VERIFIED',pages:seen.size};
}
function prefixProof(root,folder,current,expected,rawCache) {
  if(!HEX64.test(expected??''))return {status:'EXPECTED_SHA_INVALID'};
  if(current.status!=='READY')return {status:current.status};
  const full=current.parsed,matches=[];
  if(current.hash===expected)matches.push(full.files.length);
  for(let count=1;count<full.files.length;count++){
    const reconstructed={...full,files:full.files.slice(0,count)};
    if(sha(Buffer.from(JSON.stringify(reconstructed,null,2)+'\n'))===expected)matches.push(count);
  }
  if(matches.length!==1)return {status:matches.length?'AMBIGUOUS_PREFIX':'NO_EXACT_PREFIX_MATCH',currentSha256:current.hash};
  const count=matches[0],chosen={...full,files:full.files.slice(0,count)};
  // Exact byte hash is the approval boundary, not a best-effort semantic match.
  const bytes=Buffer.from(JSON.stringify(chosen,null,2)+'\n');
  if(sha(bytes)!==expected)return {status:'RECONSTRUCTION_SHA_DRIFT'};
  const key=folder+':'+expected;
  if(!rawCache.has(key))rawCache.set(key,verifyRawPrefix(root,folder,chosen));
  const raw=rawCache.get(key);
  return {status:raw.status==='RAW_VERIFIED'?'VERIFIED_PREFIX':'PREFIX_RAW_INVALID',
    expectedSha256:expected,currentSha256:current.hash,prefixFileCount:count,
    appendedAfterCandidate:full.files.length-count,rawStatus:raw.status,
    rawVerifiedPages:raw.pages??0};
}
function candidateInfo(root,filename,base,delta,cache) {
  const file=fixedFile(root,`themes/legacy-nine-r48-private-candidate/${filename}`,MAX_CANDIDATE_BYTES);
  const output={filename,date:CANDIDATE.exec(filename)?.[1]??null,status:file.status};
  if(file.status!=='READ')return output;
  if(sha(file.bytes).slice(0,16)!==CANDIDATE.exec(filename)[2])return {...output,status:'CANDIDATE_FILENAME_SHA_DRIFT'};
  const record=parseObject(file.bytes);
  if(!record||record.observationDate!==output.date||record.phase!=='CONFIRMED')
    return {...output,status:'CANDIDATE_CONTRACT_INVALID'};
  const baseProof=prefixProof(root,'legacy-nine-r23',base,record.baselineManifestSha256,cache);
  const deltaProof=record.deltaManifestSha256===null?{status:'NOT_REQUIRED'}:
    prefixProof(root,'legacy-nine-r35-delta',delta,record.deltaManifestSha256,cache);
  return {...output,status:'INSPECTED',expectedBaselineSha256:HEX64.test(record.baselineManifestSha256??'')?record.baselineManifestSha256:null,
    expectedDeltaSha256:HEX64.test(record.deltaManifestSha256??'')?record.deltaManifestSha256:null,
    baseline:baseProof,delta:deltaProof,modifiedAt:file.modifiedAt};
}
function readR54Logs(root) {
  const directory='pc-writer/theme-nine-r54/logs',d=fixedDirectory(root,directory);
  if(d.status!=='READY')return {status:d.status};
  const names=d.names.filter(n=>R54_LOG.test(n)).sort().slice(-MAX_LOGS);
  const details=names.map(name=>{
    const f=fixedFile(root,`${directory}/${name}`,MAX_LOG_BYTES);
    if(f.status!=='READ')return {name,status:f.status};
    // No raw log line is returned. Only fixed diagnostic literals are allowed.
    const str=f.bytes.toString('utf8');
    const error=str.includes('THEME_NINE_R54_SOURCE_MANIFEST_SHA_DRIFT')?'THEME_NINE_R54_SOURCE_MANIFEST_SHA_DRIFT':
      str.includes('THEME_NINE_R54_R47_PRIVATE_PAIR_NOT_UNIQUE')?'THEME_NINE_R54_R47_PRIVATE_PAIR_NOT_UNIQUE':
      str.includes('THEME_NINE_R54_R51_PRIVATE_STAGE_FAILED')?'THEME_NINE_R54_R51_PRIVATE_STAGE_FAILED':null;
    return {name,status:'READ',sha256:sha(f.bytes),modifiedAt:f.modifiedAt,sourceManifestShaDrift:error==='THEME_NINE_R54_SOURCE_MANIFEST_SHA_DRIFT',knownError:error,
      reportedStop:str.includes('STOP_R54_PUBLIC_CONNECTION'),reportedSuccess:str.includes('PUBLIC_API_VERIFIED')};
  });
  return {status:'INSPECTED',logs:details};
}
export function inspectThemeNineR54Evidence(dataRoot) {
  const out={status:'PASS',code:'THEME_NINE_R54_EVIDENCE_READONLY',
    provenance:'READ_ONLY_PC_FILES_NOT_PUBLICATION_PROOF',operationalWrites:0,
    providerCalls:0,d1Writes:0,sqliteOpened:false};
  let root;
  try {root=fs.realpathSync.native(dataRoot);}catch{return {...out,status:'BLOCKED',code:'R54_DATA_ROOT_UNAVAILABLE'};}
  const base=manifestSnapshot(root,'legacy-nine-r23'),delta=manifestSnapshot(root,'legacy-nine-r35-delta');
  const cDir=fixedDirectory(root,'themes/legacy-nine-r48-private-candidate');
  const cache=new Map();
  let candidates=[];
  if(cDir.status==='READY'){
    const names=cDir.names.filter(n=>CANDIDATE.test(n)).sort();
    candidates=names.length>MAX_CANDIDATES?[]:names.map(n=>candidateInfo(root,n,base,delta,cache));
  }
  const status=cDir.status!=='READY'?cDir.status:cDir.names.filter(n=>CANDIDATE.test(n)).length>MAX_CANDIDATES?'CANDIDATE_LIMIT':'INSPECTED';
  const r51Dir=fixedDirectory(root,'themes/legacy-nine-r51-private-provisional');
  out.r51={directoryStatus:r51Dir.status,observedCandidateNames:r51Dir.status==='READY'?r51Dir.names.filter(n=>R51.test(n)).sort().slice(-MAX_CANDIDATES):[]};
  out.manifests={baseline:{status:base.status,sha256:base.hash??null,fileCount:base.parsed?.files?.length??null},
    delta:{status:delta.status,sha256:delta.hash??null,fileCount:delta.parsed?.files?.length??null}};
  out.r48={directoryStatus:status,candidates};out.r54=readR54Logs(root);
  return out;
}
