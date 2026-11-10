// Source-only original #996 owner approval evidence adapter. Authentication
// comes from the fixed original-Windows GET-only gateway. This module does
// not create an approval, POST a comment, or authorize native C execution.
import {createHash} from 'node:crypto';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const PATH='docs/CONTROLLER_996_C_APPROVAL_R1.json';
const SHA40=/^[a-f0-9]{40}$/;
const need=(yes,code)=>{if(!yes)throw Object.assign(Error(code),{code});};

function gitBlobSha(data){
 const prefix=Buffer.from(`blob ${data.length}\0`);
 return createHash('sha1').update(prefix).update(data).digest('hex');
}

export function create996NativeConsentReader({githubReader}={}){
 need(githubReader&&typeof githubReader.get==='function'&&
  typeof githubReader.authenticateReadOnly==='function',
  'C_CONSENT_GET_PORT_MISSING');
 let used=false;
 return Object.freeze({
  readOnce({manifestCommitSha}={}){
   need(!used,'C_CONSENT_READ_ALREADY_ATTEMPTED');
   used=true; // No auto retry after partial/unverified GitHub evidence.
   need(SHA40.test(manifestCommitSha), 'C_CONSENT_COMMIT_UNPINNED');
   const auth=githubReader.authenticateReadOnly();
   need(auth?.actor==='ansqhd5774-Choi'&&auth.repository===REPO&&
    auth.private===true&&auth.readOnly===true&&
    auth.executionAuthorized===false,'C_CONSENT_GITHUB_ORIGIN_UNVERIFIED');
   const issueReply=githubReader.get('issues/996');
   need(issueReply?.status===200&&issueReply.data?.number===996&&
    issueReply.data?.user?.login==='ansqhd5774-Choi',
    'C_CONSENT_ORIGINAL_ISSUE_UNVERIFIED');
   const blobReply=githubReader.get(
    `contents/${PATH}?ref=${manifestCommitSha}`);
   const item=blobReply?.data;
   need(blobReply?.status===200&&item?.type==='file'&&
    item.path===PATH&&item.encoding==='base64'&&
    typeof item.content==='string'&&item.content.length<100_000&&
    Number.isSafeInteger(item.size)&&item.size>0&&item.size<=65_536&&
    SHA40.test(item.sha), 'C_CONSENT_IMMUTABLE_GIT_CONTENT_UNVERIFIED');
   const normalized=item.content.replace(/\s/g,'');
   need(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized),
    'C_CONSENT_GIT_CONTENT_BASE64_INVALID');
   const bytes=Buffer.from(normalized,'base64');
   need(bytes.length===item.size&&bytes.toString('base64')===normalized&&
    gitBlobSha(bytes)===item.sha,
    'C_CONSENT_GIT_BLOB_MISMATCH');
   const comments=[];
   let finished=false;
   for(let page=1;page<=100;page++){
    const response=githubReader.get(`issues/996/comments?per_page=100&page=${page}`);
    need(response?.status===200&&Array.isArray(response.data)&&
     response.data.length<=100,'C_CONSENT_COMMENTS_PAGE_UNVERIFIED');
    comments.push(...response.data);
    need(comments.length<=10_000,'C_CONSENT_COMMENTS_LIMIT_EXCEEDED');
    if(response.data.length<100){finished=true;break;}
   }
   need(finished,'C_CONSENT_COMMENTS_NOT_COMPLETE');
   const ids=new Set();
   for(const comment of comments){
    need(Number.isSafeInteger(comment?.id)&&comment.id>0&&
     !ids.has(comment.id),'C_CONSENT_COMMENTS_DUPLICATE_OR_INVALID_ID');
    ids.add(comment.id);
   }
   return Object.freeze({
    originalIssue:issueReply.data,
    commentsReadback:{complete:true,comments},
    gitRead:{repository:REPO,path:PATH,commitSha:manifestCommitSha,bytes},
    operatorManifestBytes:Buffer.from(bytes),
    executionAuthorized:false,operationalWrites:0,pcRetries:0,issuePosts:0,
   });
  },
 });
}
