// Read-only GitHub Actions scheduler state probe.
// No workflow activation, dispatch, write, or PC I/O.
export const SCHEDULE_PROBE_TARGETS=Object.freeze([
  'agent-handoff-queue-board.yml',
  'agent-handoff-proactive-diagnostics.yml',
  'agent-handoff-deep-diagnostics.yml'
]);
const STATES=new Set(['active','disabled_manually','disabled_inactivity','deleted']);
export async function inspectScheduleRegistration(io){
  if(!io||typeof io.getWorkflow!=='function'||typeof io.getScheduledRunCount!=='function')
    throw Error('SCHEDULE_PROBE_IO_REQUIRED');
  const workflows=[];
  for(const filename of SCHEDULE_PROBE_TARGETS){
    try{
      const x=await io.getWorkflow(filename);
      if(x&&typeof x==='object'&&Number.isSafeInteger(x.id)&&x.id>0&&
         x.path==='.github/workflows/'+filename&&STATES.has(x.state))
        workflows.push({file:filename,state:x.state,id:x.id,verified:true});
      else workflows.push({file:filename,state:'UNVERIFIED',id:null,verified:false});
    }catch{
      workflows.push({file:filename,state:'UNAVAILABLE',id:null,verified:false});
    }
  }
  let scheduledRuns=null;
  try{
    const x=await io.getScheduledRunCount();
    if(Number.isSafeInteger(x)&&x>=0)scheduledRuns=x;
  }catch{}
  return Object.freeze({version:'HANDOFF_SCHEDULE_PROBE_R4',
    workflows,scheduledRuns,readOnly:true,
    pcOperationalWrites:0,workflowMutations:0});
}
export function renderScheduleProbe(x){
  if(x?.version!=='HANDOFF_SCHEDULE_PROBE_R4'||!Array.isArray(x.workflows)||
     x.workflows.length!==SCHEDULE_PROBE_TARGETS.length)
    throw Error('SCHEDULE_PROBE_RENDER_STOP');
  return ['# ZGMINI 예약 트리거 GitHub 상태 (읽기 전용)',
    '',...x.workflows.map(y=>'- '+y.file+': **'+y.state+'**'+
      (y.verified?' (GitHub Actions API 검증)':' (미검증)')),
    '- 저장소 schedule 실행 누적: '+(x.scheduledRuns??'UNVERIFIED'),
    '- 등록 상태가 active여도 실제 예약 이벤트 배달 및 15분 정시 실행은 별도 증거 필요.',
    '- 운영 PC/Controller/Writer/수집/게시/워크플로 설정 변경: 0',
    ''
  ].join('\n');
}
