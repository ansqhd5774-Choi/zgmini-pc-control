// Optional local GitHub CLI credential-store adapter for the isolated Windows watcher.
// Requires C-approved gh installation/login under the SAME low-privilege Windows user.
// Never prints credentials, persists tokens or runs a GitHub write command.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const runFile=promisify(execFile);
const FORMAT=/^(?:github_pat_|gh[opusr]_|ghs_)[A-Za-z0-9_]{12,255}$/;

export function createGhCredentialProvider({
  exec=runFile, clock=()=>Date.now(), cacheMs=60_000, binary='gh'
}={}) {
  if(typeof exec!=='function'||typeof clock!=='function'||!Number.isInteger(cacheMs)||cacheMs<1000||cacheMs>300_000)
    throw Error('HANDOFF_GH_CREDENTIAL_CONFIG_INVALID');
  if(typeof binary!=='string'||!/^(?:gh|[A-Za-z]:\\[A-Za-z0-9_.\\ -]+\\gh\.exe)$/i.test(binary))
    throw Error('HANDOFF_GH_EXECUTABLE_INVALID');

  let cached=null,storedAt=-Infinity,inflight=null;
  return async ()=>{
    if(cached && clock()-storedAt<cacheMs) return cached;
    if(inflight) return inflight;
    inflight=(async()=>{
      // The CLI reads from its Windows credential store, not job environment
      // variables. No token is passed on the process command line.
      const env={...process.env};
      delete env.GITHUB_TOKEN;
      delete env.GH_TOKEN;
      let out;
      try {
        out=await exec(binary,['auth','token','--hostname','github.com'],{
          timeout:3000,maxBuffer:2048,encoding:'utf8',windowsHide:true,env
        });
      } catch {
        throw Error('HANDOFF_GH_CREDENTIAL_UNAVAILABLE');
      }
      const raw=typeof out==='string'?out:out?.stdout;
      const token=typeof raw==='string'?raw.trim():'';
      if(!FORMAT.test(token))throw Error('HANDOFF_GH_TOKEN_INVALID');
      cached=token;
      storedAt=clock();
      return token;
    })().finally(()=>{inflight=null;});
    return inflight;
  };
}
