// Preserve a completed rollback's leftover reservation; never release an
// uncertain or active recovery. Called only by the exact approved #1979 operator.
import fs from 'node:fs';import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const OLD='pc-update-7acb05d3-2860-4d19-8e30-55fe78892b12';
const NONCE='b0d28cdc-be2a-4009-b1d4-e42b7d78c5b9';
const need=(v,c)=>{if(!v)throw Object.assign(Error(c),{code:c});};
const hash=b=>createHash('sha256').update(b).digest('hex');
export function validateCompletedClaim({owner,record,archivedOwner,archivedMarker,ownerAlive}){
 need(owner.requestId===OLD&&owner.nonce===NONCE&&Number.isSafeInteger(owner.pid)&&owner.pid>0&&
  ownerAlive===false,'COMPLETED_CLAIM_OWNER_UNVERIFIED');
 need(record.schema==='ZGMINI_PC_ROLLBACK_RECONCILIATION_V1'&&record.requestId===OLD&&
  record.status==='ROLLED_BACK'&&record.code==='INTERRUPTED_ROLLBACK_VERIFIED'&&
  record.leaseArchived===true&&record.originalLedgerPreserved===true&&record.protectedStateUnchanged===true,
  'COMPLETED_CLAIM_NOT_TERMINAL');
 need(archivedOwner.nonce===archivedMarker.nonce&&archivedOwner.pid===archivedMarker.requestOwnerPid,
  'COMPLETED_CLAIM_ARCHIVE_IDENTITY');return true;
}
export function inspectCompletedClaim(root,isAlive,claimPath=path.join(root,'leases/controller-recovery')){
 const prefix=path.join(root,'recovery',OLD+'-rollback-'+NONCE);
 const files={completedClaim:path.join(claimPath,'owner.json'),completedRecord:prefix+'.json',
  completedArchivedOwner:path.join(prefix+'.lease','owner.json'),completedArchivedMarker:path.join(prefix+'.lease','RECOVERY_REQUIRED.json')};
 need(fs.lstatSync(claimPath).isDirectory()&&!fs.lstatSync(claimPath).isSymbolicLink()&&
  JSON.stringify(fs.readdirSync(claimPath))==='["owner.json"]','COMPLETED_CLAIM_DIRECTORY_DRIFT');
 const bytes=Object.fromEntries(Object.entries(files).map(([k,p])=>{
  const st=fs.lstatSync(p);need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<16384,'COMPLETED_CLAIM_FILE_DRIFT');
  return[k,fs.readFileSync(p)];}));
 const v=Object.fromEntries(Object.entries(bytes).map(([k,b])=>[k,JSON.parse(b)]));
 validateCompletedClaim({owner:v.completedClaim,record:v.completedRecord,archivedOwner:v.completedArchivedOwner,
  archivedMarker:v.completedArchivedMarker,ownerAlive:isAlive(v.completedClaim.pid)});
 return {files,bytes,hashes:Object.fromEntries(Object.entries(bytes).map(([k,b])=>[k,hash(b)]))};
}
export function archiveCompletedClaim(root,expected,isAlive){
 const reservation=path.join(root,'leases/controller-recovery-reentry');fs.mkdirSync(reservation);
 const claim=path.join(root,'leases/controller-recovery');let moved=false;
 try{
  const current=inspectCompletedClaim(root,isAlive);
  need(JSON.stringify(current.hashes)===JSON.stringify(expected.hashes),'COMPLETED_CLAIM_BYTES_CHANGED');
  const destination=path.join(root,'recovery',OLD+'-completed-claim-'+randomUUID()+'.lease');
  need(!fs.existsSync(destination),'COMPLETED_CLAIM_DESTINATION_EXISTS');
  for(const[k,p]of Object.entries(current.files))need(fs.readFileSync(p).equals(current.bytes[k]),'COMPLETED_CLAIM_BYTES_CHANGED');
  need(isAlive(JSON.parse(current.bytes.completedClaim).pid)===false,'COMPLETED_CLAIM_OWNER_REVIVED');
  fs.renameSync(claim,destination);moved=true;
  need(fs.readFileSync(path.join(destination,'owner.json')).equals(current.bytes.completedClaim),'COMPLETED_CLAIM_ARCHIVE_READBACK');
  return destination;
 }finally{if(!moved||fs.existsSync(claim)===false)fs.rmdirSync(reservation);}
}
