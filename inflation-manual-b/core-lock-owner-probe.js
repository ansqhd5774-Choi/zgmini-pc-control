// Fixed, read-only WSH/JScript probe for ONE approved Core Task and supplied
// numeric E: lock PID. No command line, identity, environment or path printed.
// Legacy EnginePID linked proof is unchanged; additional sanitized evidence
// enables an EVENT-129 identity proof when GetInstances(0) is security filtered.
(function () {
  function output(ok, linked, running, ownerMatched, createdAtMs) {
    WScript.Echo('{"ok":' + (ok ? 'true' : 'false') +
      ',"linked":' + (linked ? 'true' : 'false') +
      ',"taskRunning":' + (running ? 'true' : 'false') +
      ',"ownerCoreMatched":' + (ownerMatched ? 'true' : 'false') +
      ',"ownerCreatedAtMs":' +
      (isFinite(createdAtMs) && createdAtMs > 946684800000 ?
       String(Math.floor(createdAtMs)) : 'null') + '}');
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
  try {
    if (WScript.Arguments.length !== 1) {
      output(false, false, false, false, null); return;
    }
    var lockPidText = String(WScript.Arguments.Item(0));
    if (!/^[1-9][0-9]{0,9}$/.test(lockPidText)) {
      output(false, false, false, false, null); return;
    }
    var lockPid = Number(lockPidText);
    var scheduler = new ActiveXObject('Schedule.Service');
    scheduler.Connect();
    var task = scheduler.GetFolder('\\').GetTask('ZGMINI-PC-Local-Core');
    var taskRunning = Number(task.State) === 4;
    var running = task.GetInstances(0);
    if (!task.Enabled) {
      output(true, false, false, false, null); return;
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
        node: String(process.Name || '').toLowerCase() === 'node.exe',
        core: cmd.toLowerCase().indexOf('local-cycle.mjs') !== -1,
        matched: strictCoreCommand(cmd),
        createdAtMs: createdAt(process.CreationDate)
      };
    }
    var owner = processes[String(lockPid)];
    if (!owner || !owner.node || !owner.core) {
      output(true, false, taskRunning, false, null); return;
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
    output(true, linked, taskRunning, owner.matched && owner.node,
      owner.createdAtMs);
  } catch (ignored) {
    output(false, false, false, false, null);
  }
}());
