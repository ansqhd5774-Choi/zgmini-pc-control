// Fixed A-grade, read-only inventory transport contract. Not an installed receiver.
export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const ISSUE_TITLE='pc-inflation19-writer-source-inventory-a';
export const ISSUE_LABEL='pc-inflation19-writer-source-inventory-a';
export const SCHEMA='ZGMINI_INFL19_WRITER_SOURCE_INVENTORY_A_REQUEST_V1';
export const OPERATION='infl19-writer-source-inventory-readonly';
export const RESULT_SCHEMA='ZGMINI_INFL19_WRITER_SOURCE_INVENTORY_A_RESULT_V1';
export const SOURCE_REPO='ansqhd5774-Choi/zgmini';
export const SOURCE_BRANCH='codex/inflation19-auto-sidecar-prep-20261104';
export const SOURCE_SHA='6ffe6bb7f3ff8faa452dc86fdcc2a44d0926b1a7';
export const CODE=/^INFL19_A_[A-Z0-9_]{1,72}$/;
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REQUEST_RE=new RegExp(`^pc-${UUID}$`);
const CHAT_RE=new RegExp(`^chat-${UUID}$`);
export const stop=code=>{throw Object.assign(new Error(code),{code})};

export function validateEvent(event,env){
 if(env?.GITHUB_EVENT_ACTION!=='opened'||env?.GITHUB_REPOSITORY!==REPO||
    env?.GITHUB_ACTOR!=='ansqhd5774-Choi')stop('INFL19_A_EVENT_DENIED');
 const issue=event?.issue;
 if(event?.action!=='opened'||event?.repository?.full_name!==REPO||
    event?.repository?.private!==true||
    issue?.user?.login!=='ansqhd5774-Choi'||issue?.title!==ISSUE_TITLE||
    !Array.isArray(issue?.labels)||
    !issue.labels.some(x=>x?.name===ISSUE_LABEL)||
    !Number.isSafeInteger(issue?.number)||issue.number<1)
  stop('INFL19_A_EVENT_DENIED');
 let body;
 try{body=JSON.parse(issue.body)}catch{stop('INFL19_A_REQUEST_DENIED')}
 if(!body||Object.keys(body).sort().join(',')!==
     'chatId,operation,requestId,schema,sourceBranch,sourceRepository,sourceSha'||
    body.schema!==SCHEMA||body.operation!==OPERATION||
    body.sourceRepository!==SOURCE_REPO||body.sourceBranch!==SOURCE_BRANCH||
    body.sourceSha!==SOURCE_SHA||
    !REQUEST_RE.test(body.requestId??'')||!CHAT_RE.test(body.chatId??''))
  stop('INFL19_A_REQUEST_DENIED');
 return {requestId:body.requestId,chatId:body.chatId,issueNumber:issue.number};
}
