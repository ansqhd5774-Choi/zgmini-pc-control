// B Publisher V2 edition: private operator+adapter staged on pinned public ER1.
import fs from 'node:fs';
import path from 'node:path';
import {sha256,fail,GLOBAL_RESERVATION_PATH,ER1_SOURCE_SHA} from './er1-b-contract.mjs';
import {
 validateV2Approval,ER1_V2_SOURCE_HASHES,ER1_V2_PRIVATE_FILES,
} from './er1-b-independent-publisher-v2.mjs';

export const V2_PUBLIC_FILES=Object.keys(ER1_V2_SOURCE_HASHES);
export const V2_SOURCE_FILES=Object.freeze([...V2_PUBLIC_FILES,...ER1_V2_PRIVATE_FILES]);
export const V2_CANDIDATE='tools/market-calendar-er1/ER1_PC_OPERATION_V2_ONCE.mjs';
export const V2_ADAPTER='tools/market-calendar-er1/ER1_B_INDEPENDENT_PUBLISHER_V2.mjs';
const V2_PRIVATE_DIGESTS=Object.freeze({
 [V2_ADAPTER]:'720d014b655999df733a6dd79db65e51139d83d545a201b7f842d3191b0d4de2',
 [V2_CANDIDATE]:'9f66cc60bbda7c31b3c94f995b609be3516b6c8ef2e2eb56e640f55e02c3213b',
});
const digestPattern=/^[a-f0-9]{64}$/;
export function validateApprovalBytesV2(raw,request){
 if(!Buffer.isBuffer(raw)||raw.length<100||raw.length>16384)
  fail('ER1_B_V2_MANIFEST_SIZE_STOP');
 if(sha256(raw)!==request?.approvalManifestSha256)
  fail('ER1_B_V2_APPROVAL_HASH_STOP');
 let manifest;try{manifest=JSON.parse(raw.toString('utf8'))}
 catch{fail('ER1_B_V2_APPROVAL_JSON_STOP')}
 validateV2Approval(manifest);
 if(manifest.candidateSourceSha!==ER1_SOURCE_SHA||
   manifest.pcHome!==String.raw`E:\ZGmini\data\pc-writer`||
   manifest.dataRoot!==String.raw`E:\ZGmini\data`||
   manifest.controlLedgerPath!==GLOBAL_RESERVATION_PATH||
   manifest.allowControlLedgerWrite!==true||
   !V2_SOURCE_FILES.every(file=>digestPattern.test(manifest.sourceSha256[file]))||
   !Object.entries(V2_PRIVATE_DIGESTS).every(([file,digest])=>manifest.sourceSha256[file]===digest))
  fail('ER1_B_V2_APPROVAL_SCOPE_STOP');
 return manifest;
}
export function validateV2BundleHashes({manifest,readFile,root,pathJoin=path.join}={}){
 for(const relative of V2_SOURCE_FILES){
  const file=pathJoin(root,...relative.split('/'));
  let raw;try{raw=readFile(file)}catch{fail('ER1_B_V2_SOURCE_MISSING_STOP')}
  if(sha256(raw)!==manifest.sourceSha256[relative])
   fail('ER1_B_V2_SOURCE_DRIFT_STOP');
 }
 return true;
}
export const V2_EDITION=Object.freeze({
 validateApprovalBytes:validateApprovalBytesV2,
 validateBundleHashes:validateV2BundleHashes,
 sourceFiles:V2_SOURCE_FILES,
 candidateScript:V2_CANDIDATE.split('/').join(path.sep),
 privateOperator:path.join('operator','ER1_PC_OPERATION_V2_ONCE.mjs'),
 privateExtraStage:Object.freeze({
  [V2_ADAPTER]:path.join('er1-b-independent-publisher-v2.mjs'),
 }),
});
