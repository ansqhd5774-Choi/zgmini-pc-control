// Fixed Sidecar B receiver composition. This module is not a CLI and
// never accepts an unvalidated generic pc-job command or arbitrary target.
// An approved Windows issues workflow must still provide pinned checkout
// bytes and a real protected-state probe before this can be activated.
import {authorizeSidecarIssue} from './admission.mjs';
import {applyOneFile} from './contract.mjs';
import {createWindowsSidecarIO} from './windows-file-adapter.mjs';

const stop=code=>{throw Object.assign(new Error(code),{code});};
export async function receiveApprovedSidecarB({
 event,env,controlHead,manifestBytes,approvedBytes,observeProtected
}){
 const auth=authorizeSidecarIssue({event,env,controlHead,manifestBytes});
 if(typeof observeProtected!=='function')stop('SIDECAR_B_PROTECTED_PROBE_STOP');
 const io=createWindowsSidecarIO({
  requestId:auth.manifest.requestId,observeProtected
 });
 return applyOneFile(auth.manifest,approvedBytes,io);
}
