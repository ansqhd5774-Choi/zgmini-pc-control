import {createHash} from 'node:crypto';
// Exact two-file Controller B approval publication. The independent original
// delegation, source CI and byte construction are validated by the provided
// prepareSelectiveApprovalPublication caller before the first GitHub write.
// This module only allocates the PR number required by that existing schema.
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const id=x=>Number.isSafeInteger(x)&&x>0;
const fail=code=>{throw Error(code)};
const branchFor=target=>'codex/ci-controller-b-'+target;
const approvalPaths=target=>[
 'approvals/controller-updates/'+target+'.json',
 'approvals/controller-selective-targets/'+target+'.json'];
function exactPair(prepared,target,sourcePrNumber,approvalPrNumber){
 const paths=approvalPaths(target);
 if(prepared?.state!=='SELECTIVE_APPROVAL_FILES_PREPARED'||
  prepared.canPublish!==false||prepared.canExecute!==false||
  prepared.targetSha!==target||prepared.sourcePrNumber!==sourcePrNumber||
  prepared.approvalPrNumber!==approvalPrNumber||
  !Array.isArray(prepared.files)||prepared.files.length!==2||
  prepared.files.some((f,i)=>f.path!==paths[i]||
    !Buffer.isBuffer(f.bytes)||!f.bytes.length||f.bytes.length>32768||
    typeof f.sha256!=='string'||!/^[a-f0-9]{64}$/.test(f.sha256)||
    createHash('sha256').update(f.bytes).digest('hex')!==f.sha256))
  fail('CI_APPROVAL_PREPARATION_DENIED');
 // The reference consumed by the installed receiver must bind this exact
 // real approval PR, not the temporary preallocation number or source PR.
 try{
  const [manifest,pin]=prepared.files.map(f=>JSON.parse(f.bytes.toString('utf8')));
  const approval='https://github.com/'+REPO+'/pull/'+approvalPrNumber;
  if(manifest.targetSha!==target||pin.targetSha!==target||
     manifest.approval?.ref!==approval||pin.approvalRef!==approval)
   fail('CI_APPROVAL_PREPARATION_DENIED');
 }catch{fail('CI_APPROVAL_PREPARATION_DENIED')}
 return prepared.files;
}
function safePr(pr,number,branch,baseSha){
 const pending=pr?.state==='open'&&pr.merged===false;
 const completed=pr?.state==='closed'&&pr.merged===true&&sha(pr.merge_commit_sha);
 if(pr?.number!==number||!(pending||completed)||
  pr.draft!==false||pr.base?.ref!=='main'||pr.base?.repo?.full_name!==REPO||
  pr.head?.ref!==branch||pr.head?.repo?.full_name!==REPO||
  !sha(pr.head?.sha)||!sha(baseSha))fail('CI_APPROVAL_PR_IDENTITY_DENIED');
}
function branchRecord(v,name){
 if(!v||v.ref!=='refs/heads/'+name||v.object?.type!=='commit'||!sha(v.object.sha))
  fail('CI_APPROVAL_BRANCH_IDENTITY_DENIED');
 return v.object.sha;
}
// io is a pinned, narrow GitHub REST adapter. The source grant and PR
// construction are passed in from trusted policy, never from a GitHub event.
// Each unknown write outcome stops; the same invocation never retries a POST.
export async function publishExactControllerApprovalPair({
 targetSha,sourcePrNumber,sourceMainSha,prepare,io
}={}){
 if(!sha(targetSha)||!sha(sourceMainSha)||!id(sourcePrNumber)||
  !io||typeof prepare!=='function'||![
  'readRepository','readMain','readBranch','readPrs','readPr','readPrFiles',
  'readBytes','readCommit','createTree','createCommit','createBranch',
  'createPr','updateBranch'].every(k=>typeof io[k]==='function'))
  fail('CI_APPROVAL_BOOTSTRAP_INPUT_DENIED');
 const repo=await io.readRepository();
 if(repo?.id!==1442936296||repo.full_name!==REPO||repo.private!==true||
  repo.owner?.login!=='ansqhd5774-Choi')fail('CI_APPROVAL_REPOSITORY_DENIED');
 const preliminary=exactPair(await prepare(2147483647),targetSha,sourcePrNumber,2147483647);
 const name=branchFor(targetSha),paths=approvalPaths(targetSha);
 const base=await io.readMain();
 if(!sha(base?.commit?.sha))fail('CI_APPROVAL_MAIN_UNVERIFIED');
 const main=await io.readCommit(base.commit.sha);
 if(main?.sha!==base.commit.sha||!sha(main.tree?.sha))
  fail('CI_APPROVAL_MAIN_UNVERIFIED');
 const seed=Buffer.from(JSON.stringify({schema:'ZGMINI_CI_APPROVAL_PR_BOOTSTRAP_V1',
  targetSha,sourcePrNumber,sourceMainSha})+'\n');
 // Check the original PR inventory BEFORE any branch creation. An
 // already merged/deleted branch must never be silently recreated by a
 // second source-CI or main-push event for the same approved effect.
 const prior=await io.readPrs(name);
 if(!Array.isArray(prior)||prior.length>1)
  fail('CI_APPROVAL_PR_INVENTORY_UNVERIFIED');
 let existing=await io.readBranch(name);
 const branchAlreadyThere=existing!==null;
 if(existing===null&&prior.length)
  return {state:'STATE_UNKNOWN',code:'CI_APPROVAL_PRIOR_PR_WITHOUT_BRANCH_NO_REPOST',
   branch:name,prNumber:id(prior[0]?.number)?prior[0].number:null};
 let pr=null;
 if(existing===null){
  // Only a bootstrap marker is written. It fails the Controller B schema
  // and therefore cannot be executed even if an untrusted caller sees it.
  const tree=await io.createTree({base_tree:main.tree.sha,tree:[{
   path:paths[0],mode:'100644',type:'blob',content:seed.toString('utf8')}]});
  if(!sha(tree?.sha))fail('CI_APPROVAL_SEED_UNVERIFIED');
  const commit=await io.createCommit({message:'chore(ci): allocate exact Controller B PR',
   tree:tree.sha,parents:[base.commit.sha]});
  if(!sha(commit?.sha))fail('CI_APPROVAL_SEED_UNVERIFIED');
  // If creation times out, do not blindly try the same mutation again.
  await io.createBranch({ref:'refs/heads/'+name,sha:commit.sha});
  existing=await io.readBranch(name);
  if(existing===null||branchRecord(existing,name)!==commit.sha)
   fail('CI_APPROVAL_BRANCH_READBACK_UNKNOWN');
 }else branchRecord(existing,name);
 const oldHead=branchRecord(existing,name);
 const found=branchAlreadyThere?prior:await io.readPrs(name);
 if(!Array.isArray(found)||found.length>1)fail('CI_APPROVAL_PR_INVENTORY_UNVERIFIED');
 if(found.length){
  pr=found[0];
 }else{
  // A preexisting branch with no PR can be an uncertain prior creation.
  // No second create PR is allowed for that state.
  const seedAtHead=await io.readBytes(oldHead,paths[0]);
  if(!Buffer.isBuffer(seedAtHead)||!seedAtHead.equals(seed)||
     oldHead===base.commit.sha)
   fail('CI_APPROVAL_BOOTSTRAP_CONFLICT');
  // A persisted branch from an older attempt is not proof of a missing PR.
  // Caller must reconcile the existing original PR rather than retry.
  if(branchAlreadyThere)
   return {state:'STATE_UNKNOWN',code:'CI_APPROVAL_PRIOR_BRANCH_WITHOUT_PR',branch:name};
  await io.createPr({head:name,base:'main',
   title:'Controller B exact selective approval '+targetSha,
   body:'Generated from independently pinned original business scope and source CI. Exact two-file diff required. No operational source or permission change.',
   draft:false});
  const after=await io.readPrs(name);
  if(!Array.isArray(after)||after.length!==1)
   return {state:'STATE_UNKNOWN',code:'CI_APPROVAL_PR_READBACK_UNKNOWN',branch:name};
  pr=after[0];
 }
 if(!id(pr?.number)||pr.number===sourcePrNumber)
  fail('CI_APPROVAL_PR_IDENTITY_DENIED');
 const original=await io.readPr(pr.number);
 safePr(original,pr.number,name,base.commit.sha);
 if(original.head.sha!==oldHead)fail('CI_APPROVAL_HEAD_DRIFT');
 // The approval PR number is now allocated. Repeat the independent
 // source/delegation/CI validation against the actual immutable reference.
 const files=exactPair(await prepare(pr.number),targetSha,sourcePrNumber,pr.number);
 const already=await io.readPrFiles(pr.number);
 if(!Array.isArray(already)||already.length>3)
  fail('CI_APPROVAL_DIFF_UNVERIFIED');
 const diffPaths=already.map(x=>x.filename).sort();
 if(diffPaths.some(x=>!paths.includes(x))||new Set(diffPaths).size!==diffPaths.length)
  fail('CI_APPROVAL_DIFF_DENIED');
 const final=already.length===2&&already.every(x=>x.status==='added');
 if(final){
  for(const file of files){
   const bytes=await io.readBytes(oldHead,file.path);
   if(!Buffer.isBuffer(bytes)||!bytes.equals(file.bytes))
    fail('CI_APPROVAL_EXISTING_BYTES_CONFLICT');
  }
  return {state:'EXACT_APPROVAL_PR_READY',prNumber:pr.number,
   headSha:oldHead,branch:name,existing:true};
 }
 if(original.merged===true)fail('CI_APPROVAL_MERGED_PAIR_UNVERIFIED');
 if(already.length!==1||already[0].filename!==paths[0]||already[0].status!=='added')
  fail('CI_APPROVAL_BOOTSTRAP_DIFF_DENIED');
 const old=await io.readBytes(oldHead,paths[0]);
 if(!Buffer.isBuffer(old)||!old.equals(seed))
  fail('CI_APPROVAL_BOOTSTRAP_BYTES_DENIED');
 const previous=await io.readCommit(oldHead);
 if(previous?.sha!==oldHead||!sha(previous.tree?.sha))
  fail('CI_APPROVAL_BRANCH_COMMIT_UNVERIFIED');
 const tree=await io.createTree({base_tree:previous.tree.sha,tree:files.map(f=>({
  path:f.path,mode:'100644',type:'blob',content:f.bytes.toString('utf8')}))});
 if(!sha(tree?.sha))fail('CI_APPROVAL_PAIR_TREE_UNVERIFIED');
 const next=await io.createCommit({message:'chore(ci): materialize exact approved Controller B pair',
  tree:tree.sha,parents:[oldHead]});
 if(!sha(next?.sha))fail('CI_APPROVAL_PAIR_COMMIT_UNVERIFIED');
 const beforePatch=await io.readBranch(name);
 if(beforePatch===null||branchRecord(beforePatch,name)!==oldHead)
  fail('CI_APPROVAL_HEAD_DRIFT');
 await io.updateBranch(name,{sha:next.sha,force:false});
 const [current,pairDiff]=await Promise.all([io.readPr(pr.number),io.readPrFiles(pr.number)]);
 if(current?.head?.sha!==next.sha||!Array.isArray(pairDiff)||pairDiff.length!==2||
  pairDiff.some(x=>x.status!=='added')||
  JSON.stringify(pairDiff.map(x=>x.filename).sort())!==JSON.stringify([...paths].sort()))
  return {state:'STATE_UNKNOWN',code:'CI_APPROVAL_PAIR_READBACK_UNKNOWN',
   branch:name,prNumber:pr.number};
 for(const file of files){
  const bytes=await io.readBytes(next.sha,file.path);
  if(!Buffer.isBuffer(bytes)||!bytes.equals(file.bytes))
   return {state:'STATE_UNKNOWN',code:'CI_APPROVAL_PAIR_READBACK_UNKNOWN',
    branch:name,prNumber:pr.number};
 }
 return {state:'EXACT_APPROVAL_PR_READY',prNumber:pr.number,
  headSha:next.sha,branch:name,existing:false};
}
