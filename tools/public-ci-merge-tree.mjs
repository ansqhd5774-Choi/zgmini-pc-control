// Bind Public scanners to the GitHub-created PR merge tree, never a stale head checkout.
// The inspected commit range remains original event base..head.
import {execFileSync} from 'node:child_process';
import {assessPublicSourceCi} from './public-source-ci-guard.mjs';
const sha=/^[a-f0-9]{40}$/;
export function verifiedPublicMergeRange(event,env,git){
 if(assessPublicSourceCi({event,env}).status!=='PASS')throw Error('PUBLIC_CI_MERGE_ORIGIN_UNTRUSTED');
 const base=event.pull_request.base.sha,head=event.pull_request.head.sha;
 const merge=git(['rev-parse','HEAD']).trim();
 const parents=git(['rev-list','--parents','-n','1','HEAD']).trim().split(/\s+/);
 if(!sha.test(merge)||merge!==env.GITHUB_SHA||merge===base||merge===head||
    parents.length!==3||parents[0]!==merge||parents[1]!==base||parents[2]!==head)
  throw Error('PUBLIC_CI_MERGE_TREE_MISMATCH');
 return {base,head};
}
export function verifyPublicMergeCheckout(event,env){
 return verifiedPublicMergeRange(event,env,args=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim());
}
