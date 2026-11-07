// Candidate ONE-LINE entrypoint hook for the existing maintenance-agent.
// Call before its legacy four-title filter; a non-matching Issue passes
// through untouched. NO installed binding, cli, network or local I/O here.
import {GENERIC_B_TITLE} from './approved-generic-b-route.mjs';

const stop=code=>{const e=Error(code);e.code=code;throw e;};
export function makeMaintenanceAgentGenericBHook({approvedRoute}={}){
 if(typeof approvedRoute?.receive!=='function')
  stop('B_MAINTENANCE_HOOK_ROUTE_NOT_INSTALLED');
 return Object.freeze({
  async dispatch(issue){
   if(issue?.title!==GENERIC_B_TITLE)return Object.freeze({handled:false});
   // Maintainer only authenticates, packages and calls the FIXED update.mjs
   // CLI. The effect route runs inside the pinned updater, never here.
   const result=await approvedRoute.receive({issue});
   // The caller must persist/re-read this status using a separately approved
   // one-shot B ledger. A PASS without 2/2 results is NOT public success.
   return Object.freeze({handled:true,result});
  },
 });
}
