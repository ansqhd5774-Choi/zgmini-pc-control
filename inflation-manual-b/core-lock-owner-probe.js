// Fixed, read-only WSH/JScript probe for ONE approved Core Task and supplied
// numeric E: lock PID. No command line, identity, environment or path printed.
// Legacy EnginePID linked proof is unchanged; additional sanitized evidence
// enables an EVENT-129 identity proof when GetInstances(0) is security filtered.
(function () {
  function output(ok, linked, running, ownerMatched, koreaMatched, createdAtMs,
    vbsLinked, vbsCreatedAtMs, launcherKinds) {
    WScript.Echo('{"ok":' + (ok ? 'true' : 'false') +
      ',"linked":' + (linked ? 'true' : 'false') +
      ',"taskRunning":' + (running ? 'true' : 'false') +
      ',"ownerCoreMatched":' + (ownerMatched ? 'true' : 'false') +
      ',"ownerKoreaMatched":' + (koreaMatched ? 'true' : 'false') +
      ',"ownerCreatedAtMs":' +
      (isFinite(createdAtMs) && createdAtMs > 946684800000 ?
       String(Math.floor(createdAtMs)) : 'null') +
      ',"taskVbsLinked":' + (vbsLinked===true?'true':'false') +
      ',"taskVbsCreatedAtMs":' +
      (isFinite(vbsCreatedAtMs)&&vbsCreatedAtMs>946684800000?
       String(Math.floor(vbsCreatedAtMs)):'null') +
      ',"approvedLauncherKinds":' +
      JSON.stringify(launcherKinds instanceof Array?launcherKinds:[]) + '}');
  }
  function createdAt(raw) {
    var stamp = String(raw || '');
    var ts = /^(\d{14})\.\d{6}([+-])(\d{3})$/.exec(stamp);
    if (!ts) return null;
    var utc = Date.UTC(Number(stamp.substring(0,4)),
      Number(stamp.substring(4,6))-1,Number(stamp.substring(6,8)),
      Number(stamp.substring(8,10)),Number(stamp.substring(10,12)),
      Number(stamp.substring(12,14)));
    var offset = Number(ts[3])*(ts[2]==='+'?1:-1);
    return utc-offset*60000;
  }
  // V2 alternative proof only: command must be the exact approved Node and
  // source script, no extra args or a second process merely named node.exe.
  function strictCoreCommand(raw) {
    var command = String(raw || '').replace(/^\s+|\s+$/g,'');
    return /^(?:"E:\\ZGmini\\runtime\\node\.exe"|E:\\ZGmini\\runtime\\node\.exe)\s+(?:"E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release\\scripts\\pc-writer\\local-cycle\.mjs"|E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release\\scripts\\pc-writer\\local-cycle\.mjs)\s+--publish$/i.test(command);
  }
  // Korea uses the SAME local-cycle lock as Core. Exact command recognition
  // can justify bounded re-observation, NEVER acceptance as Core ownership.
  function strictKoreaCommand(raw) {
    var command = String(raw || '').replace(/^\s+|\s+$/g,'');
    return /^(?:"E:\\ZGmini\\runtime\\node\.exe"|E:\\ZGmini\\runtime\\node\.exe)\s+(?:"E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release\\scripts\\pc-writer\\local-cycle\.mjs"|E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release\\scripts\\pc-writer\\local-cycle\.mjs)\s+(?:--korea(?:\s+--publish)?|--publish\s+--korea)$/i.test(command);
  }

  // Do not accept an arbitrary WScript/Node process as the Core Task.
  // These launchers are pinned again by SHA-256 inside the trusted adapter.
  function normalizeCommand(value) {
    return String(value || '').replace(/"/g,'')
      .replace(/^\s+|\s+$/g,'').replace(/\s+/g,' ').toLowerCase();
  }
  function vbsKind(record) {
    if(record.name!=='wscript.exe')return null;
    var command=normalizeCommand(record.command);
    var exe=['wscript.exe','c:\\windows\\system32\\wscript.exe',
      'c:\\windows\\syswow64\\wscript.exe'];
    var scripts=[
      {kind:'TASK_VBS',file:'e:\\zgmini\\data\\pc-writer\\archive-sidecar-r7\\run-original-then-archive.vbs'},
      {kind:'CUTOVER_VBS',file:'e:\\zgmini\\data\\pc-writer\\cutover-evidence\\inflation-r37-2026-10-20t19-39-19-549z\\run-local-core.vbs'}
    ];
    var switches=['','//b ','//nologo ','//b //nologo '];
    for(var i=0;i<exe.length;i++)for(var j=0;j<scripts.length;j++)
      for(var k=0;k<switches.length;k++)
        if(command===exe[i]+' '+switches[k]+scripts[j].file)
          return scripts[j].kind;
    return null;
  }
  function intermediaryNodeKind(record) {
    if(record.name!=='node.exe')return null;
    var command=normalizeCommand(record.command);
    var bin='e:\\zgmini\\runtime\\node.exe ';
    var scripts=[
      {kind:'ARCHIVE_NODE',file:'e:\\zgmini\\data\\pc-writer\\archive-sidecar-r7\\archive-run.mjs'},
      {kind:'ARCHIVE_CORE_NODE',file:'e:\\zgmini\\data\\pc-writer\\archive-sidecar-r7\\archive-core-r10.mjs'}
    ];
    for(var i=0;i<scripts.length;i++)
      if(command===bin+scripts[i].file||
         command===bin+scripts[i].file+' --publish')
        return scripts[i].kind;
    return null;
  }
  function verifiedVbsChain(processes,lockPid,anchorPid){
    var denied={ok:false,createdAtMs:null,kinds:[]};
    if(!isFinite(anchorPid)||anchorPid<1)return denied;
    var current=lockPid,visited={},lastStart=null,kinds=[];
    for(var i=0;i<12;i++){
      if(visited[String(current)])return denied;
      visited[String(current)]=true;
      var row=processes[String(current)];
      if(!row||!isFinite(row.createdAtMs)||row.createdAtMs<946684800000)
        return denied;
      if(lastStart!==null&&row.createdAtMs>lastStart+1000)return denied;
      var kind=i===0?(row.node&&row.matched?'CORE_NODE':null):
        vbsKind(row)||intermediaryNodeKind(row);
      if(!kind)return denied;
      if(kind==='TASK_VBS'){
        if(current!==anchorPid)return denied;
        kinds.push(kind);
        return {ok:true,createdAtMs:row.createdAtMs,kinds:kinds};
      }
      if(kind!=='CORE_NODE')kinds.push(kind);
      if(!isFinite(row.parent)||row.parent<1)return denied;
      lastStart=row.createdAtMs;
      current=row.parent;
    }
    return denied;
  }
  try {
    if (WScript.Arguments.length !== 1 && WScript.Arguments.length !== 2) {
      output(false, false, false, false, false, null); return;
    }
    var lockPidText = String(WScript.Arguments.Item(0));
    if (!/^[1-9][0-9]{0,9}$/.test(lockPidText)) {
      output(false, false, false, false, false, null); return;
    }
    var lockPid = Number(lockPidText);
    var anchorText=WScript.Arguments.length===2?String(WScript.Arguments.Item(1)):null;
    if(anchorText!==null&&!/^[1-9][0-9]{0,9}$/.test(anchorText)){
      output(false,false,false,false,false,null);return;
    }
    var anchorPid=anchorText!==null?Number(anchorText):null;
    var scheduler = new ActiveXObject('Schedule.Service');
    scheduler.Connect();
    var task = scheduler.GetFolder('\\').GetTask('ZGMINI-PC-Local-Core');
    var taskRunning = Number(task.State) === 4;
    var running = task.GetInstances(0);
    if (!task.Enabled) {
      output(true, false, false, false, false, null); return;
    }
    var engines = {};
    for (var i = 1; i <= running.Count; i += 1) {
      var pid = Number(running.Item(i).EnginePID);
      if (isFinite(pid) && pid > 0) engines[String(pid)] = true;
    }
    var wmi = GetObject('winmgmts:root\\cimv2');
    var query = 'SELECT ProcessId,ParentProcessId,Name,CommandLine,CreationDate FROM Win32_Process';
    var iterator = new Enumerator(wmi.ExecQuery(query));
    var processes = {};
    for (; !iterator.atEnd(); iterator.moveNext()) {
      var process = iterator.item();
      var processPid = Number(process.ProcessId);
      if (!isFinite(processPid) || processPid < 1) continue;
      var cmd=String(process.CommandLine || '');
      processes[String(processPid)] = {
        parent: Number(process.ParentProcessId),
        name: String(process.Name || '').toLowerCase(),
        command: cmd,
        node: String(process.Name || '').toLowerCase() === 'node.exe',
        core: cmd.toLowerCase().indexOf('local-cycle.mjs') !== -1,
        matched: strictCoreCommand(cmd),
        koreaMatched: strictKoreaCommand(cmd),
        createdAtMs: createdAt(process.CreationDate)
      };
    }
    var owner = processes[String(lockPid)];
    if (!owner || !owner.node || !owner.core) {
      output(true, false, taskRunning, false, false, null); return;
    }
    var seen = {}, current = lockPid, linked = false;
    for (var depth = 0; depth < 96; depth += 1) {
      if (engines[String(current)]) { linked = true; break; }
      if (seen[String(current)]) break;
      seen[String(current)] = true;
      var record = processes[String(current)];
      if (!record || !isFinite(record.parent) || record.parent < 1) break;
      current = record.parent;
    }
    var chain=anchorPid!==null&&taskRunning&&owner.matched&&owner.node?
      verifiedVbsChain(processes,lockPid,anchorPid):
      {ok:false,createdAtMs:null,kinds:[]};
    output(true, linked, taskRunning, owner.matched && owner.node,
      owner.koreaMatched && owner.node,owner.createdAtMs,
      chain.ok,chain.createdAtMs,chain.kinds);
  } catch (ignored) {
    output(false, false, false, false, false, null);
  }
}());
