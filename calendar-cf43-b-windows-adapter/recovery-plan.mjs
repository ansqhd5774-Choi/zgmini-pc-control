// Pure state classification shared by the live catch path and fault fixtures.
// It never presumes a failed OS/Git command was a no-op. Unknown => leave task
// disabled and lock/journal for human-approved recovery, never blind rollback.
const SRC=new Set(['BASE_DIRTY','BRANCH_DIRTY','COMMITTED_CLEAN']);
export function classifyRecovery({taskState,sourceState,configState,
 approvedBytesMatch,drained}={}){
 if(!['ENABLED','DISABLED'].includes(taskState)||!SRC.has(sourceState)||
  !['BASE','CHILD'].includes(configState)||approvedBytesMatch!==true)
  return 'RECOVERY_REQUIRED';
 if(taskState==='ENABLED')
  return sourceState==='BASE_DIRTY'&&configState==='BASE'?
   'STOP_NO_MUTATION':'RECOVERY_REQUIRED';
 return drained===true?'SAFE_ROLLBACK':'RECOVERY_REQUIRED';
}
