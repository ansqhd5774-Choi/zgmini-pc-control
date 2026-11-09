// Windows Script Host JScript 5.8. This file is read-only and must run via
// cscript.exe //NoLogo using a fixed checked-out control-repo path.
// It NEVER prints a process command line or secret; only numeric evidence.
// Task Scheduler COM gives language-independent state and running instances.
(function () {
  try {
    var service = new ActiveXObject('Schedule.Service');
    service.Connect();
    var task = service.GetFolder('\\').GetTask('ZGMINI-PC-Local-Core');
    var runningTasks = task.GetInstances(0);
    var instances = runningTasks.Count;
    var coreEngines = {};
    var unknown = 0;
    for (var n = 1; n <= instances; n += 1) {
      // A running Core instance provides an exact process-tree anchor.
      var enginePid = 0;
      try { enginePid = Number(runningTasks.Item(n).EnginePID); } catch (engineError) { }
      if (!isFinite(enginePid) || enginePid < 1) {
        // The task instance is already an explicit drain blocker. Missing
        // EnginePID must not prevent us from pausing future triggers.
        unknown += 1;
        continue;
      }
      coreEngines[String(enginePid)] = true;
    }
    var related = 0;
    var wmi = GetObject('winmgmts:root\\cimv2');
    // Include parent process records so an inaccessible CommandLine from an
    // unrelated Runner cannot block Core. Only task-linked/known-Core process
    // trees are treated as Core; a genuinely ambiguous Core descendant blocks.
    var processes = wmi.ExecQuery('SELECT ProcessId,ParentProcessId,Name,CommandLine FROM Win32_Process');
    var records = [];
    var byPid = {};
    var iterator = new Enumerator(processes);
    for (; !iterator.atEnd(); iterator.moveNext()) {
      var process = iterator.item();
      var pid = Number(process.ProcessId);
      var parentPid = process.ParentProcessId === null ||
        typeof process.ParentProcessId === 'undefined' ? NaN : Number(process.ParentProcessId);
      var name = String(process.Name || '').toLowerCase();
      var missing = process.CommandLine === null ||
        typeof process.CommandLine === 'undefined' ||
        String(process.CommandLine).replace(/\s/g, '') === '';
      var command = missing ? '' : String(process.CommandLine).toLowerCase();
      var relevantName = name === 'node.exe' || name === 'cmd.exe' ||
        name === 'cscript.exe' || name === 'wscript.exe';
      // Exact Core entrypoints are retained, irrespective of C: junction vs E:.
      // A generic 'zgmini pc-writer' command belongs to many independent jobs.
      var isCore = command.indexOf('local-cycle.mjs') !== -1 ||
        command.indexOf('run-local.mjs') !== -1;
      var record = {pid:pid, parent:parentPid, missing:missing,
        relevant:relevantName, core:isCore};
      records.push(record);
      if (isFinite(pid) && pid > 0) byPid[String(pid)] = record;
      if (isCore) related += 1;
    }
    for (var i = 0; i < records.length; i += 1) {
      var rec = records[i];
      if (!rec.relevant || !rec.missing) continue;
      // If a protected-process PID/parent is absent, its ownership cannot be
      // established, so retain fail-closed behavior for that specific record.
      if (!isFinite(rec.pid) || rec.pid < 1 ||
          !isFinite(rec.parent) || rec.parent < 0) {
        unknown += 1;
        continue;
      }
      var seen = {};
      var current = rec.pid;
      for (var depth = 0; depth < records.length + 1; depth += 1) {
        if (coreEngines[String(current)]) { unknown += 1; break; }
        if (seen[String(current)]) break;
        seen[String(current)] = true;
        var ancestor = byPid[String(current)];
        if (!ancestor) break;
        if (ancestor.core) { unknown += 1; break; }
        if (!isFinite(ancestor.parent) || ancestor.parent <= 0) break;
        current = ancestor.parent;
      }
    }
    // Windows Script Host may expose JScript's 5.7-compatible surface even
    // when the installed engine reports 5.8. Use no built-in JSON serializer.
    // Every interpolated value is a number or boolean; no WMI command line,
    // user-controlled string, task path or secret is ever echoed.
    WScript.Echo('{"ok":true,"enabled":' + (task.Enabled ? 'true' : 'false') +
      ',"state":' + Number(task.State) +
      ',"instances":' + Number(instances) +
      ',"relatedProcesses":' + related +
      ',"unknownProcessLines":' + unknown + '}');
  } catch (error) {
    // This fallback must also work without the JSON global.
    WScript.Echo('{"ok":false,"code":"WRITER_B_1063_TASK_PROBE_STOP"}');
    WScript.Quit(2);
  }
}());
