// SOURCE_ONLY universal GitHub Issue ingress contract. New shared-resource
// routes register one descriptor here; workflow protection stays fail closed.
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA64=/^[a-f0-9]{64}$/;
const MANIFEST=/^approvals\/writer-updates\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;

// Register future B-type operations here, not as feature-specific exceptions.
export const APPROVAL_ROUTES=Object.freeze({
  'writer-source-b':Object.freeze({
    label:'pc-writer-b-install',
    title:'pc-writer-source-install',
    schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
    operation:'pc-writer-source-install',
    approvalPathPattern:MANIFEST,
    requestKeys:Object.freeze(['schema','requestId','chatId','operation',
      'controlRepository','approvalManifestPath','approvalManifestSha256']),
  })
});
const stop=code=>{throw new Error('SHARED_ISSUE_ADMISSION_'+code);};
const exactKeys=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));

function validRequest(route,req) {
  return exactKeys(req,route.requestKeys) &&
    req.schema===route.schema && req.operation===route.operation &&
    req.controlRepository===REPO && UUID.test(req.requestId??'') &&
    UUID.test(req.chatId??'') && SHA64.test(req.approvalManifestSha256??'') &&
    route.approvalPathPattern.test(req.approvalManifestPath??'');
}

/** Exact body/title/label errors are explicit; no PC execution is implied. */
export function inspectSharedIssueAdmission({title,labels,body}) {
  const labelNames=Array.isArray(labels)?labels.map(v=>typeof v==='string'?v:v?.name):[];
  const routes=Object.entries(APPROVAL_ROUTES).filter(([,r])=>labelNames.includes(r.label));
  if(routes.length===0){
    const named=Object.entries(APPROVAL_ROUTES).filter(([,r])=>title===r.title);
    if(named.length===1)return Object.freeze({state:'REJECTED_AT_ADMISSION',
      code:'EXACT_RESOURCE_LABEL_REQUIRED',kind:named[0][0],
      expectedLabel:named[0][1].label});
    return Object.freeze({state:'UNMANAGED',code:'NO_REGISTERED_RESOURCE_ROUTE'});
  }
  if(routes.length!==1)return Object.freeze({state:'REJECTED_AT_ADMISSION',code:'MULTIPLE_RESOURCE_ROUTES'});
  const [kind,route]=routes[0];
  if(title!==route.title)return Object.freeze({state:'REJECTED_AT_ADMISSION',
    code:'EXACT_ISSUE_TITLE_REQUIRED',kind,expectedTitle:route.title});
  let req;
  try{req=JSON.parse(body);}catch{return Object.freeze({state:'REJECTED_AT_ADMISSION',
    code:'REQUEST_JSON_INVALID',kind});}
  if(!validRequest(route,req))return Object.freeze({
    state:'REJECTED_AT_ADMISSION',code:'REQUEST_MANIFEST_OR_IDENTITY_INVALID',kind});
  return Object.freeze({state:'ADMITTED_TO_WORKFLOW',code:'EXACT_ROUTE_VERIFIED',kind,
    requestId:req.requestId});
}

/** For supported routes, construct an exact valid Issue before publishing. */
export function prepareSharedApprovalIssue(kind,request) {
  const route=APPROVAL_ROUTES[kind];
  if(!route)stop('ROUTE_NOT_REGISTERED');
  if(!validRequest(route,request))stop('REQUEST_INVALID');
  const issue=Object.freeze({title:route.title,
    labels:Object.freeze([route.label]),body:JSON.stringify(request)});
  if(inspectSharedIssueAdmission(issue).state!=='ADMITTED_TO_WORKFLOW')
    stop('PREPUBLICATION_MISMATCH');
  return issue;
}
