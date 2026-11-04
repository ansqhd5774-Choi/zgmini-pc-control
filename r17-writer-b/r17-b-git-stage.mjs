// Purely local, injectable Git object/index transaction. Source checkout is
// read-only. Only the caller's scratch repository gets new blobs/tree/commit.
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const SHA40=/^[a-f0-9]{40}$/;
const commitEnv={
  GIT_AUTHOR_NAME:'ZGMINI R17 Approved PC Writer',GIT_AUTHOR_EMAIL:'r17-writer-b@localhost',
  GIT_COMMITTER_NAME:'ZGMINI R17 Approved PC Writer',GIT_COMMITTER_EMAIL:'r17-writer-b@localhost',
  GIT_AUTHOR_DATE:'2026-11-05T00:00:00Z',GIT_COMMITTER_DATE:'2026-11-05T00:00:00Z',
};
export function commitExactOverlay({stage,base,overlay,expectedSha256,expectedDiff,run,runRaw}){
  const stop=(code)=>{throw Object.assign(new Error(code),{code});};
  if(!SHA40.test(base)||!(overlay instanceof Map)||
     overlay.size!==Object.keys(expectedSha256).length)stop('R17_B_OVERLAY_SCOPE_STOP');
  for(const [file,bytes] of overlay){
    if(!Object.hasOwn(expectedSha256,file)||!Buffer.isBuffer(bytes)||
      sha(bytes)!==expectedSha256[file])stop('R17_B_OVERLAY_HASH_STOP');
    const blob=runRaw(stage,['hash-object','-w','--stdin'],{stdin:bytes})
      .toString('utf8').trim();
    if(!SHA40.test(blob))stop('R17_B_OVERLAY_BLOB_STOP');
    run(stage,'update-index','--add','--cacheinfo',`100644,${blob},${file}`);
  }
  const tree=run(stage,'write-tree');
  if(!SHA40.test(tree))stop('R17_B_OVERLAY_TREE_STOP');
  const commit=runRaw(stage,['commit-tree',tree,'-p',base],{
    stdin:Buffer.from('R17 approved Writer exact five-file source commit\n','utf8'),
    env:commitEnv,
  }).toString('utf8').trim();
  if(!SHA40.test(commit)||commit===base)stop('R17_B_OVERLAY_COMMIT_STOP');
  const diff=run(stage,'diff-tree','--no-commit-id','--name-status','-r',base,commit)
    .split(/\r?\n/).filter(Boolean).map(line=>{const [status,p]=line.split('\t');return {status,path:p};});
  if(diff.length!==expectedDiff.length||
    !expectedDiff.every(d=>diff.filter(x=>x.path===d.path&&x.status===d.status).length===1))
    stop('R17_B_OVERLAY_DIFF_STOP');
  for(const [file,hash] of Object.entries(expectedSha256)){
    if(sha(runRaw(stage,['show',`${commit}:${file}`]))!==hash)
      stop('R17_B_OVERLAY_READBACK_STOP');
  }
  return {sha:commit,diff};
}
