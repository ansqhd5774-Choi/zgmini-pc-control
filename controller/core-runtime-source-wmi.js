// Windows Script Host JScript: ONE read-only Task Scheduler + WMI snapshot.
// No raw CommandLine, credentials, filesystem writes, or process execution.
// Only hard-coded Core executable/entrypoint equality is emitted as E/C marker.
(function () {
  function done(value, code) {
    WScript.Echo(value);
    if (code) WScript.Quit(code);
  }
  function integer(value) {
    var x = Number(value);
    return isFinite(x) && x >= 0 && Math.floor(x) === x ? x : null;
  }
  function normalized(s) {
    return String(s || '').replace(/\//g, '\\').replace(/^"|"$/g, '').toLowerCase();
  }
  function coreSourceMarker(raw) {
    if (raw === null || typeof raw === 'undefined') return '';
    // A single, exact Node executable + script + --publish. No extra args.
    var match = /^\s*("[A-Za-z]:\\[^"\r\n]*node\.exe"|[A-Za-z]:\\[^\s"\r\n]*node\.exe)\s+("[A-Za-z]:\\[^"\r\n]*local-cycle\.mjs"|[A-Za-z]:\\[^\s"\r\n]*local-cycle\.mjs)\s+--publish\s*$/i.exec(String(raw));
    if (!match) return '';
    var executable = normalized(match[1]);
    var script = normalized(match[2]);
    if (executable !== 'e:\\zgmini\\runtime\\node.exe') return '';
    if (script === 'e:\\zgmini\\projects\\zgmini-earnings-history-pc-release\\scripts\\pc-writer\\local-cycle.mjs') return 'E';
    if (script === 'c:\\zgmini\\projects\\zgmini-earnings-history-pc-release\\scripts\\pc-writer\\local-cycle.mjs') return 'C';
    return '';
  }
  try {
    var service = new ActiveXObject('Schedule.Service');
    service.Connect();
    var task = service.GetFolder('\\').GetTask('ZGMINI-PC-Local-Core');
    var running = task.GetInstances(0);
    var engines = [], engineSeen = {};
    for (var i = 1; i <= running.Count; i += 1) {
      var engine = null;
      try { engine = integer(running.Item(i).EnginePID); } catch (ignoreEngine) { }
      if (engine !== null && engine > 0 && !engineSeen[String(engine)]) {
        engineSeen[String(engine)] = true;
        engines.push(engine);
      }
    }
    var wmi = GetObject('winmgmts:root\\cimv2');
    var results = wmi.ExecQuery('SELECT ProcessId,ParentProcessId,Name,CommandLine,CreationDate FROM Win32_Process');
    var processes = [], item = new Enumerator(results);
    for (; !item.atEnd(); item.moveNext()) {
      var p = item.item();
      var current = integer(p.ProcessId);
      var parent = integer(p.ParentProcessId);
      if (current === null) continue;
      if (processes.length >= 8192) done('{"ok":false,"code":"WMI_PROCESS_LIMIT"}', 2);
      var name = String(p.Name || '').toLowerCase();
      var marker = name === 'node.exe' ? coreSourceMarker(p.CommandLine) : '';
      var created = null;
      try {
        var stamp = String(p.CreationDate || '');
        if (/^\d{14}\./.test(stamp)) {
          created = Date.UTC(Number(stamp.substring(0,4)),Number(stamp.substring(4,6))-1,
            Number(stamp.substring(6,8)),Number(stamp.substring(8,10)),
            Number(stamp.substring(10,12)),Number(stamp.substring(12,14)));
          if (!isFinite(created)) created = null;
        }
      } catch (ignoreCreated) { }
      // Every field emitted is numeric or from a fixed four-string enum.
      processes.push('{"pid":' + current + ',"parentPid":' + (parent===null?'null':parent) +
        ',"name":"' + (name==='node.exe'?'node.exe':'other') +
        '","sourceMarker":"' + marker + '","createdAtMs":' +
        (created===null?'null':created) + '}');
    }
    done('{"ok":true,"runningInstances":' + Number(running.Count) +
      ',"engines":[' + engines.join(',') + '],"processes":['+
      processes.join(',') + ']}', 0);
  } catch (error) {
    done('{"ok":false,"code":"WMI_TASK_READ_UNAVAILABLE"}', 2);
  }
}());
