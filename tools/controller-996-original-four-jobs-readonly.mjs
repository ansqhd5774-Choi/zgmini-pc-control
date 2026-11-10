// #996 direct reconciliation of four pre-existing pc-job issues: GET ONLY.
// Requires an independently authenticated read port; this pure helper cannot
// prove its provenance. No replay, result promotion, Issue post or C grant.

const OWNER='ansqhd5774-Choi';
const OWNER_ID=327938088;
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const REPO_ID=1442936296;
const SOURCE='643b7c7c4372ffad552443fc312c6cb1b944e2fc';
const EXPECTED=Object.freeze([
  [1217,'pc-8da91b23-f5d6-4a94-bcd5-13b0dfcdee61',
    'chat-67a52680-bdae-4afb-8047-7dee6264e503','core-runtime-source-readonly'],
  [1219,'pc-e2710720-1a35-4a75-ab37-4940ecd33edd',
    'chat-a6d121b8-b770-4dcd-a4ca-26a6cae3e531','core-runtime-source-readonly'],
  [1226,'pc-60ed9565-9b87-4099-a4d2-db9235a3cfd4',
    'chat-fed29d4e-d3da-4363-a1b8-398da674d6a5','core-status'],
  [1227,'pc-6f7a24d4-823d-4648-b2c3-a645a352bef7',
    'chat-94ed8b6e-9bb8-4afd-a6f1-9e96f5893a76','core-runtime-source-readonly'],
]);
const BODY_KEYS=['chatId','operation','requestId','schema','sourceBranch',
  'sourceRepository','sourceSha'];
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sorted=x=>x.slice().sort();
const result=(status,entries)=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_FOUR_ORIGINAL_JOBS_GET_V1',
  status,originalIssueCount:entries.length,
  entries:Object.freeze(entries),
  independentPcStateVerified:false,backlogJournalVerified:false,
  ownerContinuationConsentVerified:false,executionAuthorized:false,
  productionExecutable:false,operationalWrites:0,workflowPuts:0,
  backlogWrites:0,issuePosts:0,pcRetries:0,
});

export function create996FourOriginalJobsReadOnlyReader({githubReader}={}){
  need(githubReader&&typeof githubReader.get==='function'&&
    typeof githubReader.authenticateReadOnly==='function',
  'C_996_ORIGINAL_JOBS_GET_PORT_MISSING');
  let used=false;
  async function scan(){
    const rows=[];
    for(const [number,requestId,chatId,operation] of EXPECTED){
      const issue=await githubReader.get(`issues/${number}`);
      const i=issue?.data;
      need(issue?.status===200&&i?.number===number&&
        i.user?.login===OWNER&&i.user?.id===OWNER_ID&&
        i.state==='open'&&i.comments===0&&!i.pull_request&&
        i.labels?.some(x=>(typeof x==='string'?x:x?.name)==='pc-job'),
      'C_996_ORIGINAL_JOBS_STATUS_OR_ORIGIN_DRIFT');
      let body;
      try{body=JSON.parse(i.body);}catch{}
      need(body&&typeof body==='object'&&!Array.isArray(body)&&
        same(sorted(Object.keys(body)),BODY_KEYS)&&
        body.schema==='ZGMINI_PC_JOB_V1'&&body.requestId===requestId&&
        body.chatId===chatId&&body.operation===operation&&
        body.sourceRepository==='ansqhd5774-Choi/zgmini'&&
        body.sourceBranch==='main'&&body.sourceSha===SOURCE,
      'C_996_ORIGINAL_JOBS_REQUEST_BYTES_DRIFT');
      const comments=await githubReader.get(
        `issues/${number}/comments?per_page=100&page=1`);
      need(comments?.status===200&&Array.isArray(comments.data)&&
        comments.data.length===0,
      'C_996_ORIGINAL_JOBS_RECEIPT_OR_COMMENT_PRESENT');
      rows.push(Object.freeze({issueNumber:number,requestId,
        nextAction:'OWNER_REPLAN_REVIEW_REQUIRED',
        state:'open',resultVerified:false,
        issueUpdatedAt:i.updated_at??null}));
    }
    return rows;
  }
  return Object.freeze({async readOnce(){
    need(!used,'C_996_ORIGINAL_JOBS_REPEATED_READ_DENIED');
    used=true;
    const auth=await githubReader.authenticateReadOnly();
    need(auth?.repository===REPO&&auth.repositoryId===REPO_ID&&
      auth.ownerAccountId===OWNER_ID&&auth.private===true&&
      auth.readOnly===true&&auth.executionAuthorized===false&&
      auth.testOnly!==true&&
      (auth.kind==='INSTALLATION_REPOSITORY_GET'&&
        auth.actor==='github-app-installation'||
       auth.kind==='OWNER_USER_GET'&&auth.actor===OWNER),
    'C_996_ORIGINAL_JOBS_GITHUB_GET_ORIGIN_UNVERIFIED');
    const first=await scan(),second=await scan();
    need(same(first,second),'C_996_ORIGINAL_JOBS_READBACK_CHANGED');
    return result('FOUR_ORIGINAL_JOBS_UNRESOLVED_GET_ONLY',second);
  }});
}
