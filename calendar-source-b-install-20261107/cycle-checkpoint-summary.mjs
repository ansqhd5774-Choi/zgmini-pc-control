// Read-only, bounded projection of the existing Core cycle checkpoint.
// No raw checkpoint, provider data, paths or error strings are exported.
const reason=new Set(['AUXILIARY_INPUTS_UNCHANGED',
 'CHECKPOINT_UNAVAILABLE_OR_EARLY_NOT_VERIFIED','AUXILIARY_INPUTS_CHANGED']);
const collectionReason=new Set(['QUOTA_GUARD','COLLECTION_FAILED']);
const status=new Set(['PUBLICATION_NOT_VERIFIED','COMPLETE',
 'COMPLETE_WITH_COLLECTION_GAPS']);
const inputPolicy=new Set(['NORMAL_STORED_INPUTS','VALID_STORED_INPUTS_ONLY']);
const code=x=>Number.isInteger(x)&&x>=-100&&x<=65535?x:null;
export function summarizeCycleCheckpoint(raw,{modifiedAt=null,hash=null}={}){
 const o=JSON.parse(Buffer.isBuffer(raw)?raw.toString('utf8'):String(raw));
 const p=o?.publicationPolicy??{},g=o?.progressive??{};
 return {
  exists:true,
  modifiedAt:typeof modifiedAt==='string'&&Number.isFinite(Date.parse(modifiedAt))?
   modifiedAt:null,
  checkpointSha256:typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash)?hash:null,
  status:status.has(o?.status)?o.status:'UNKNOWN',
  publishRequested:o?.publishRequested===true,
  publicationExit:code(o?.publicationExit),
  collectionExit:code(o?.collectionExit),
  collectionStatus:['COMPLETE','ERROR','FAILED','SOURCE_FAILED'].includes(o?.collectionStatus)?
   o.collectionStatus:'UNKNOWN',
  policyPublishAllowed:p?.publishAllowed===true,
  policyCollectionDegraded:p?.collectionDegraded===true,
  policyInputPolicy:inputPolicy.has(p?.inputPolicy)?p.inputPolicy:'UNKNOWN',
  policyCollectionReason:collectionReason.has(p?.collectionReason)?p.collectionReason:null,
  progressiveEnabled:g?.enabled===true,
  progressiveEarlyExit:code(g?.earlyExit),
  progressiveFinalSkipped:g?.finalSkipped===true,
  progressiveReason:reason.has(g?.reason)?g.reason:'UNKNOWN',
 };
}
