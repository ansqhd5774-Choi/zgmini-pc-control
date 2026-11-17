// Read-only, token-free C activation preflight for the independent queue-PC watcher.
// This checks the exact pinned SOURCE and local host; it cannot authorize/install
// Windows tasks, provision credentials, start the watcher or prove 5s runtime.
import {readFileSync,lstatSync,realpathSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const C_SOURCE_COMMIT='f1a280b9c24ec8d01ee228115b92ebb964f49802';
export const C_SOURCE_BLOBS=Object.freeze({
  'agent-handoff/intake-watch-5s.mjs':'2515dd83b96f76146dc75991fa8648cae6d42382',
  'agent-handoff/intake-receipt-readonly.mjs':'0b97307fc3bf1ed8462a5a6413c3fc8f12bbb08b',
  'agent-handoff/queue-selector.mjs':'964faf91138989cf3b42c44afbb6a77a1d2712b1',
  'agent-handoff/queue-priority.mjs':'5178eb3b531e9f48c7f4ac9bc13888219425ed6a',
  'agent-handoff/contract.mjs':'9b65f341c31a2ef6ac67be6824079806207ad72c',
  'agent-handoff/watcher-gh-credential.mjs':'03340fc943af09c6be7b55e635d09b30ef346ff5',
  'tools/handoff-watch-user-start.cmd':'1b1773df0e9f64093ce509bb1a3590da99096024'
});
const HERE=path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT=path.resolve(HERE,'..');
const MAX_BYTES=2_000_000;
const gitBlob=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');

// All checks are bounded local reads. Credentials, user names and absolute
// paths are deliberately never printed or returned.
export function inspectWatchCPreflight({
  root=DEFAULT_ROOT,platform=process.platform,hostname=os.hostname(),
  nodeVersion=process.version,env=process.env
}={}){
  if(typeof root!=='string'||!root || typeof hostname!=='string'||
      typeof nodeVersion!=='string'||typeof env!=='object'||!env)
    throw Error('HANDOFF_WATCH_PREFLIGHT_INVALID_INPUT');
  const checks=[];
  for(const [file,expected] of Object.entries(C_SOURCE_BLOBS)){
    let ok=false,windowsCmdCrLfNormalized=false;
    try {
      const target=path.resolve(root,...file.split('/'));
      // Explicitly reject symlinks to avoid validating an unexpected source.
      if(lstatSync(target).isFile() && !lstatSync(target).isSymbolicLink() &&
          statSync(target).size<=MAX_BYTES &&
          (platform==='win32'?realpathSync(target).toLowerCase()===target.toLowerCase():realpathSync(target)===target)){
        const bytes=readFileSync(target);
        if(bytes.length<=MAX_BYTES){
          ok=gitBlob(bytes)===expected;
          if(!ok && file==='tools/handoff-watch-user-start.cmd'){
            // A Windows checkout may have CRLF worktree bytes even if the
            // repository stores the identical CMD as LF. Accept ONLY this
            // single deterministic line-ending transformation.
            const normalized=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
            if(normalized.length<bytes.length && gitBlob(normalized)===expected){
              ok=true;
              windowsCmdCrLfNormalized=true;
            }
          }
        }
      }
    }catch{/* A missing/inaccessible/mismatching local source is a STOP. */}
    checks.push({file,matched:ok,windowsCmdCrLfNormalized});
  }
  const sourceFilesMatch=checks.every(x=>x.matched);
  const hostMatch=platform==='win32'&&hostname.toUpperCase()==='DESKTOP-N62L0NG';
  const node22=/^v22\.[0-9]+\.[0-9]+$/.test(nodeVersion);
  const rawTokenEnvironmentAbsent=!(env.GITHUB_TOKEN||env.GH_TOKEN);
  const sourceEligible=sourceFilesMatch&&hostMatch&&node22&&rawTokenEnvironmentAbsent;
  return {
    schema:'ZGMINI_HANDOFF_WATCH_C_PREFLIGHT_R1',
    readOnly:true,sourceCommit:C_SOURCE_COMMIT,
    sourceFilesChecked:checks.length,sourceFilesMatched:checks.filter(x=>x.matched).length,
    sourceFiles:checks,hostMatch,node22,rawTokenEnvironmentAbsent,
    sourceEligible,credentialStoreVerified:false,windowsTaskRegisteredVerified:false,
    runtimeHeartbeatVerified:false,installerExecuted:false,pcWrites:0,
    state:sourceEligible?'SOURCE_PREFLIGHT_PASS_C_AUTH_AND_TASK_REQUIRED':'SOURCE_PREFLIGHT_STOP'
  };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const report=inspectWatchCPreflight();
  process.stdout.write(JSON.stringify(report)+'\n');
  if(!report.sourceEligible)process.exitCode=2;
}
