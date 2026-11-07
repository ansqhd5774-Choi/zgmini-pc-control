// Exact approved overlay in an ISOLATED Git object/index store. Never stages
// or writes files in the live Writer checkout; adapted from r17-b-git-stage.
import {sha256} from './contract.mjs';

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const SHA40=/^[a-f0-9]{40}$/i;
const REQUEST_REF=/^refs\/heads\/writer-b\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GIT_COMMIT_ENV=Object.freeze({
 GIT_AUTHOR_NAME:'ZGMINI Approved Writer B',
 GIT_AUTHOR_EMAIL:'writer-b@localhost',
 GIT_COMMITTER_NAME:'ZGMINI Approved Writer B',
 GIT_COMMITTER_EMAIL:'writer-b@localhost',
 GIT_AUTHOR_DATE:'2026-11-07T00:00:00Z',
 GIT_COMMITTER_DATE:'2026-11-07T00:00:00Z',
});

export function commitApprovedWriterBOverlay({stage,base,manifestFiles,overlay,
 requestRef,run,runRaw}){
 need(typeof stage==='string'&&SHA40.test(base??'')&&
   REQUEST_REF.test(requestRef??'')&&Array.isArray(manifestFiles)&&
   manifestFiles.length>=1&&manifestFiles.length<=32&&
   overlay instanceof Map&&overlay.size===manifestFiles.length&&
   typeof run==='function'&&typeof runRaw==='function',
   'WRITER_B_STAGE_CONTRACT_STOP');
 const listed=new Map(manifestFiles.map(file=>[file.path,file]));
 need(listed.size===manifestFiles.length,'WRITER_B_STAGE_DUPLICATE_STOP');
 for(const [file,bytes] of overlay){
  const expected=listed.get(file);
  need(expected&&Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=2_000_000&&
   sha256(bytes)===expected.afterSha256,'WRITER_B_STAGE_OVERLAY_HASH_STOP');
  const blob=runRaw(stage,['hash-object','-w','--stdin'],{stdin:bytes})
    .toString('utf8').trim();
  need(SHA40.test(blob),'WRITER_B_STAGE_BLOB_STOP');
  run(stage,'update-index','--add','--cacheinfo',`100644,${blob},${file}`);
 }
 const tree=run(stage,'write-tree');
 need(SHA40.test(tree),'WRITER_B_STAGE_TREE_STOP');
 const sha=runRaw(stage,['commit-tree',tree,'-p',base],{
  stdin:Buffer.from('Approved Writer B exact manifest file overlay\n','utf8'),
  env:GIT_COMMIT_ENV,
 }).toString('utf8').trim();
 need(SHA40.test(sha)&&sha!==base,'WRITER_B_STAGE_COMMIT_STOP');
 const diff=run(stage,'diff-tree','--no-commit-id','--name-status','-r',base,sha)
   .split(/\r?\n/).filter(Boolean).map(line=>{
    const [change,file]=line.split('\t');return {change,path:file};
   });
 need(diff.length===manifestFiles.length&&manifestFiles.every(file=>
  diff.filter(d=>d.path===file.path&&d.change===file.change).length===1),
  'WRITER_B_STAGE_DIFF_STOP');
 for(const file of manifestFiles)
  need(sha256(runRaw(stage,['show',`${sha}:${file.path}`]))===file.afterSha256,
   'WRITER_B_STAGE_READBACK_STOP');
 run(stage,'update-ref',requestRef,sha);
 need(run(stage,'rev-parse','--verify',requestRef)===sha&&
  runRaw(stage,['cat-file','-t',requestRef]).toString('utf8').trim()==='commit',
  'WRITER_B_STAGE_REF_READBACK_STOP');
 return {sha,parent:base,changedPaths:manifestFiles.map(x=>x.path),
  sha256:Object.fromEntries(manifestFiles.map(x=>[x.path,x.afterSha256])),
  clean:true,sourceRef:requestRef};
}
