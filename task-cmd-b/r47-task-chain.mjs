// Fixed, reviewed existing launcher chain only. No generic shell/CMD parser.
import path from 'node:path';
export const R47_CHAIN_ROOT=String.raw`E:\ZGmini\data\pc-writer\theme-nine-r48`;
export const R47_CHAIN_PINS=Object.freeze({
 'THEME_NINE_R73_SCHEDULED_PRIVATE.cmd':'599a3c710322858faf021d90b4c80fdcf2d3ba02d084f090bd34b42ae13a778b',
 'theme-nine-r73-auto-http502-private-retry.mjs':'0940698222e0eba68940c0bb36023c71a53e29fb8c8ffdbb032b1492c4b168dc',
 'theme-nine-r71-private-recovery-once.mjs':'41556b023b565c863cf25eabc5b78a4a6de95d880070f5bb019106e7be55404d',
 'THEME_NINE_R48_PRIVATE_CYCLE.cmd':'7356da2ae151eceb2b3306b40c13de3394eef3476e15ca1528128006748ed0c4',
});
const same=(a,b)=>typeof a==='string'&&path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
export function verifiedR47TaskRoute(actual,target){
 if(!actual||!same(target,path.win32.join(R47_CHAIN_ROOT,'THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd')))return false;
 if(same(actual.taskActionPath,target))return true;
 const p=actual.taskChainProof;
 return p?.kind==='PINNED_R73_R48_CHAIN'&&
  same(actual.taskActionPath,path.win32.join(R47_CHAIN_ROOT,'THEME_NINE_R73_SCHEDULED_PRIVATE.cmd'))&&
  same(p.taskActionPath,actual.taskActionPath)&&same(p.targetPath,target)&&
  p.arguments===''&&(p.workingDirectory===''||same(p.workingDirectory,R47_CHAIN_ROOT))&&
  p.files&&Object.keys(p.files).length===Object.keys(R47_CHAIN_PINS).length&&
  Object.entries(R47_CHAIN_PINS).every(([name,digest])=>p.files[name]===digest);
}
