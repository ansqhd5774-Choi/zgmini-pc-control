// Source-only, read-only GitHub main READY feed adapter. Never creates an Issue.
// `githubGet` MUST be an authenticated, fixed-repository GitHub REST GET; do
// not supply cached Issue text, coordination comments or local checkout data.
import {createHash} from 'node:crypto';
import {parseTrustedControllerReadyFeed,CONTROLLER_READY_FEED_PATH}
 from './maintenance-admission-queue.mjs';

const REPOSITORY='ansqhd5774-Choi/zgmini-pc-control';
const API=`/repos/${REPOSITORY}`;
const BLOB_SHA=/^[a-f0-9]{40}$/;
const unknown=code=>Object.freeze({status:'STATE_UNKNOWN',code});

function decodeGitHubBase64(record){
 if(!record||record.encoding!=='base64'||typeof record.content!=='string')return null;
 const encoded=record.content.replace(/\s/g,'');
 if(!encoded||encoded.length>45000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))return null;
 const bytes=Buffer.from(encoded,'base64');
 if(bytes.length<2||bytes.length>32768||bytes.length!==record.size)return null;
 return bytes;
}

/** GitHub `contents?ref=main` with local immutable Git blob digest proof.
 * This is deliberately not wired into the installed maintainer. The host
 * must supply independently checked, real user B execution approval callback.
 */
export async function readTrustedControllerReadyFromGitHub({githubGet,
 verifyBExecutionApproval,allowedActors}={}){
 if(typeof githubGet!=='function')return unknown('QUEUE_GITHUB_GET_ADAPTER_MISSING');
 let source;
 try{source=await githubGet(`${API}/contents/${CONTROLLER_READY_FEED_PATH}?ref=main`);}
 catch{return unknown('QUEUE_READY_MAIN_GET_UNCERTAIN');}
 if(source?.type!=='file'||source.path!==CONTROLLER_READY_FEED_PATH
  ||!BLOB_SHA.test(String(source.sha??'')))
  return unknown('QUEUE_READY_MAIN_METADATA_UNVERIFIED');
 const bytes=decodeGitHubBase64(source);
 if(!bytes)return unknown('QUEUE_READY_MAIN_BYTES_UNVERIFIED');
 const blobSha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 if(blobSha!==source.sha)return unknown('QUEUE_READY_MAIN_SHA_MISMATCH');
 return parseTrustedControllerReadyFeed({bytes,sourceRepository:REPOSITORY,
  sourceRef:'main',sourcePath:CONTROLLER_READY_FEED_PATH,
  mainReadbackVerified:true,verifyBExecutionApproval,allowedActors});
}
