// Publish the two sanitized evidence files in one Git commit. The branch ref
// is updated once (non-force), so a concurrent writer cannot leave half a pair.
import {CONTROL_REPOSITORY} from './contract.mjs';

const SHA40=/^[a-f0-9]{40}$/i;
const need=(ok,code)=>{if(!ok)throw new Error(code);};
const api=`https://api.github.com/repos/${CONTROL_REPOSITORY}`;

async function json(fetchApi,url,opts,expected){
 const res=await fetchApi(url,opts);
 if(res?.status!==expected){
  // Only expose a bounded API phase and HTTP status; no request, path,
  // response body, token, result contents, or automatic retry.
  const method=opts?.method==='POST'?'POST':'GET';
  const path=new URL(url).pathname;
  const phase=path.endsWith('/git/ref/heads/main')?'GET_REF':
    path.includes('/git/commits/')?'GET_COMMIT':
    path.endsWith('/git/blobs')?'POST_BLOB':
    path.endsWith('/git/trees')?'POST_TREE':
    path.endsWith('/git/commits')?'POST_COMMIT':
    path.startsWith('/repos/')&&path.includes('/contents/')?'GET_CONTENTS':
    'OTHER_GITHUB_API';
  const error=new Error('CONFIG_B_PAIR_REMOTE_STOP');
  error.remoteStage=method+'_'+phase;
  error.remoteStatus=Number.isInteger(res?.status)&&res.status>=100&&res.status<=599?res.status:null;
  throw error;
 }
 const value=await res.json();
 need(value&&typeof value==='object','CONFIG_B_PAIR_RESPONSE_STOP');
 return value;
}

export async function uploadResultPairAtomic({outputs,headers,fetchApi=fetch,
 message='chore(pc): record one-shot sanitized evidence'}={}){
 need(Array.isArray(outputs)&&outputs.length===2&&
  outputs[0][0].endsWith('.json')&&outputs[1][0].endsWith('.txt')&&
  outputs.every(([p,s])=>typeof p==='string'&&
   /^results\/[a-zA-Z0-9._-]{1,160}\.(?:json|txt)$/.test(p)&&
   typeof s==='string'&&Buffer.byteLength(s)>0&&Buffer.byteLength(s)<32768)&&
  outputs[0][0].slice(0,-5)===outputs[1][0].slice(0,-4)&&
  typeof headers?.authorization==='string'&&
  typeof message==='string'&&message.length<160,
 'CONFIG_B_PAIR_INPUT_STOP');
 const get={method:'GET',headers};
 const ref=await json(fetchApi,`${api}/git/ref/heads/main`,get,200);
 const base=ref?.object?.sha;
 need(SHA40.test(base??''),'CONFIG_B_PAIR_BASE_STOP');
 // `git/trees` can overwrite an existing path. Reject every pre-existing
 // result before creating any Git object; branch fast-forward protects races.
 for(const [path] of outputs){
  let found;
  try{found=await fetchApi(`${api}/contents/${path}?ref=${base}`,get);}
  catch{return{created:0,verified:0,delivery:'RESULT_PAIR_PREFLIGHT_UNVERIFIED'};}
  if(found?.status!==404)return{created:0,verified:0,
   delivery:'RESULT_PAIR_ALREADY_EXISTS_OR_PREFLIGHT_UNVERIFIED'};
 }
 const original=await json(fetchApi,`${api}/git/commits/${base}`,get,200);
 const baseTree=original?.tree?.sha;
 need(SHA40.test(baseTree??''),'CONFIG_B_PAIR_TREE_STOP');
 const entries=[];
 for(const [path,content] of outputs){
  const blob=await json(fetchApi,`${api}/git/blobs`,{method:'POST',headers,
   body:JSON.stringify({content:Buffer.from(content).toString('base64'),
    encoding:'base64'})},201);
  need(SHA40.test(blob?.sha??''),'CONFIG_B_PAIR_BLOB_STOP');
  entries.push({path,mode:'100644',type:'blob',sha:blob.sha});
 }
 const tree=await json(fetchApi,`${api}/git/trees`,{method:'POST',headers,
  body:JSON.stringify({base_tree:baseTree,tree:entries})},201);
 need(SHA40.test(tree?.sha??''),'CONFIG_B_PAIR_TREE_STOP');
 let commit=await json(fetchApi,`${api}/git/commits`,{method:'POST',headers,
  body:JSON.stringify({message,tree:tree.sha,parents:[base]})},201);
 need(SHA40.test(commit?.sha??''),'CONFIG_B_PAIR_COMMIT_STOP');
 // Only a definite HTTP 422 with a NEW verified descendant HEAD and
 // both destination paths absent permits rebuilding this same evidence pair.
 // Two separately proven advances are bounded; no retry on ambiguous PATCH,
 // stale/unchanged HEAD, non-descendant ref, missing proof or existing file.
 // This retries Git ref publication only, never the PC operation.
 let updated=null,moved=null,verifiedBase=base;
 const MAX_PROVEN_REF_ADVANCES=2;
 const patch=async sha=>{
  try{
   const response=await fetchApi(`${api}/git/refs/heads/main`,{method:'PATCH',headers,
    body:JSON.stringify({sha,force:false})});
   if(response?.status===200){
    let value=null;
    try{value=await response.json();}catch{/* Readback below resolves ambiguity. */}
    return {response,moved:value};
   }
   return {response,moved:null};
  }catch{return {response:null,moved:null};}
 };
 for(let proven=0;;proven++){
  ({response:updated,moved}=await patch(commit.sha));
  if(updated?.status!==422)break;
  if(proven>=MAX_PROVEN_REF_ADVANCES)
   return{created:0,verified:0,delivery:'RESULT_PAIR_REF_CONFLICT_UNTOUCHED'};
  let live;
  try{
   const now=await json(fetchApi,`${api}/git/ref/heads/main`,get,200);
   live=now?.object?.sha;
   if(!SHA40.test(live??'')||live===verifiedBase)
    return{created:0,verified:0,delivery:'RESULT_PAIR_REF_CONFLICT_UNTOUCHED'};
   const compared=await json(fetchApi,
    `${api}/compare/${verifiedBase}...${live}`,get,200);
   if(compared?.status!=='ahead')
    return{created:0,verified:0,delivery:'RESULT_PAIR_REF_CONFLICT_UNTOUCHED'};
   for(const [filePath] of outputs){
    const found=await fetchApi(`${api}/contents/${filePath}?ref=${live}`,get);
    if(found?.status!==404)return{created:0,verified:0,
     delivery:'RESULT_PAIR_ALREADY_EXISTS_OR_PREFLIGHT_UNVERIFIED'};
   }
   const head=await json(fetchApi,`${api}/git/commits/${live}`,get,200);
   need(SHA40.test(head?.tree?.sha??''),'CONFIG_B_PAIR_TREE_STOP');
   const newerTree=await json(fetchApi,`${api}/git/trees`,{method:'POST',headers,
    body:JSON.stringify({base_tree:head.tree.sha,tree:entries})},201);
   need(SHA40.test(newerTree?.sha??''),'CONFIG_B_PAIR_TREE_STOP');
   commit=await json(fetchApi,`${api}/git/commits`,{method:'POST',headers,
    body:JSON.stringify({message,tree:newerTree.sha,parents:[live]})},201);
   need(SHA40.test(commit?.sha??''),'CONFIG_B_PAIR_COMMIT_STOP');
  }catch{return{created:0,verified:0,delivery:'RESULT_PAIR_REF_CONFLICT_UNTOUCHED'};}
  verifiedBase=live;
 }
 let branchContainsCommit=updated?.status===200&&moved?.object?.sha===commit.sha;
 if(!branchContainsCommit){
  try{
   const now=await json(fetchApi,`${api}/git/ref/heads/main`,get,200);
   const liveSha=now?.object?.sha;
   if(liveSha===commit.sha)branchContainsCommit=true;
   else if(SHA40.test(liveSha??'')){
    const compare=await json(fetchApi,
     `${api}/compare/${commit.sha}...${liveSha}`,get,200);
    branchContainsCommit=['ahead','identical'].includes(compare?.status);
   }
  }catch{/* Keep unconfirmed, do not retry a possibly applied PATCH. */}
 }
 if(!branchContainsCommit)return{created:null,verified:0,
  delivery:'RESULT_PAIR_REF_UNVERIFIED_READ_ONLY_RECONCILE'};
 let verified=0;
 for(const [path,content] of outputs){
  try{
   const file=await json(fetchApi,`${api}/contents/${path}?ref=${commit.sha}`,
    get,200);
   if(file?.encoding==='base64'&&
    Buffer.from(String(file.content).replace(/\s/g,''),'base64')
     .equals(Buffer.from(content)))verified++;
  }catch{/* No retry after a post-commit readback failure. */}
 }
 return{created:2,verified,delivery:verified===2?
  'RESULT_PAIR_READBACK_VERIFIED':'RESULT_PAIR_READBACK_UNVERIFIED'};
}
