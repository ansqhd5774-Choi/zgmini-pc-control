// Read-only WSH/JScript probe for ONE fixed Task and one supplied numeric PID.
// Never print command lines, environment, paths, credentials or process lists.
// The Node caller independently reads the fixed E: Core lock and owns the PID.
(function () {
  function output(ok, linked) {
    WScript.Echo('{"ok":' + (ok ? 'true' : 'false') +
      ',"linked":' + (linked ? 'true' : 'false') + '}');
  }
  try {
    if (WScript.Arguments.length !== 1) { output(false, false); return; }
    var lockPidText = String(WScript.Arguments.Item(0));
    if (!/^[1-9][0-9]{0,9}$/.test(lockPidText)) {
      output(false, false); return;
    }
    var lockPid = Number(lockPidText);
    var scheduler = new ActiveXObject('Schedule.Service');
    scheduler.Connect();
    var task = scheduler.GetFolder('\\').GetTask('ZGMINI-PC-Local-Core');
    var running = task.GetInstances(0);
    if (!task.Enabled || running.Count < 1) {
      output(true, false); return;
    }
    var engines = {};
    for (var i = 1; i <= running.Count; i += 1) {
      var pid = Number(running.Item(i).EnginePID);
      if (isFinite(pid) && pid > 0) engines[String(pid)] = true;
    }
    var wmi = GetObject('winmgmts:root\\cimv2');
    var query = 'SELECT ProcessId,ParentProcessId,Name,CommandLine FROM Win32_Process';
    var iterator = new Enumerator(wmi.ExecQuery(query));
    var processes = {};
    for (; !iterator.atEnd(); iterator.moveNext()) {
      var process = iterator.item();
      var processPid = Number(process.ProcessId);
      if (!isFinite(processPid) || processPid < 1) continue;
      processes[String(processPid)] = {
        parent: Number(process.ParentProcessId),
        node: String(process.Name || '').toLowerCase() === 'node.exe',
        core: String(process.CommandLine || '').toLowerCase()
          .indexOf('local-cycle.mjs') !== -1
      };
    }
    var owner = processes[String(lockPid)];
    if (!owner || !owner.node || !owner.core) {
      output(true, false); return;
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
    output(true, linked);
  } catch (ignored) {
    output(false, false);
  }
}());
