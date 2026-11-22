// Windows Script Host JScript: ONE read-only Task Scheduler + WMI snapshot.
// No raw CommandLine, credentials, filesystem writes, or process execution.
// Only a syntactically allowlisted E:/C: Core entrypoint is emitted as a
// bounded relative project path; arbitrary CommandLine text is never echoed.
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
    if (raw === null || typeof raw === 'undefined') return null;
    // A single, exact Node executable + script + --publish. No extra args.
    var match = /^\s*("[A-Za-z]:\\[^"\r\n]*node\.exe"|[A-Za-z]:\\[^\s"\r\n]*node\.exe)\s+("[A-Za-z]:\\[^"\r\n]*local-cycle\.mjs"|[A-Za-z]:\\[^\s"\r\n]*local-cycle\.mjs)\s+--publish\s*$/i.exec(String(raw));
    if (!match) return null;
    var executable = normalized(match[1]);
    var script = normalized(match[2]);
    if (executable !== 'e:\\zgmini\\runtime\\node.exe') return null;
    var found = /^([ec]):\\zgmini\\projects\\(.+)\\scripts\\pc-writer\\local-cycle\.mjs$/i.exec(script);
    if (!found) return null;
    var parts = found[2].split('\\');
    if (parts.length < 1 || parts.length > 3) return null;
    for (var j = 0; j < parts.length; j += 1) {
      if (!/^[a-z0-9_-][a-z0-9._-]{0,79}$/i.test(parts[j])) return null;
    }
    return {drive:found[1].toUpperCase(),relativeRoot:parts.join('\\')};
  }
  try {
    var service = new ActiveXObject('Schedule.Service');
    service.Connect();
    var task = service.GetFolder('\\').GetTask('ZGMINI-PC-Local-Core');
    var taskStateBefore = integer(task.State);
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
    // GetInstances(0) can omit this Hidden task although State is RUNNING.
    // The documented service enumeration includes hidden tasks without
    // changing privileges/settings. Accept only the exact registered path.
    var observedInstances = Number(running.Count);
    var instanceIds = [];
    var engineOrigin = 'REGISTERED_TASK_GET_INSTANCES';
    if (engines.length === 0) {
      try {
        var allRunning = service.GetRunningTasks(1);
        var exactCount = 0;
        for (var ri = 1; ri <= allRunning.Count; ri += 1) {
          var rt = allRunning.Item(ri);
          if (String(rt.Path || '').toLowerCase() !== '\\zgmini-pc-local-core') continue;
          var guid = String(rt.InstanceGuid || '');
          var servicePid = integer(rt.EnginePID);
          if (!/^\{[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\}$/i.test(guid) ||
              servicePid === null || servicePid <= 0 || integer(rt.State) !== 4) continue;
          exactCount += 1;
          instanceIds.push(guid.toLowerCase());
          if (!engineSeen[String(servicePid)]) {
            engineSeen[String(servicePid)] = true;
            engines.push(servicePid);
          }
        }
        if (exactCount > 0) {
          observedInstances = exactCount;
          engineOrigin = 'TASK_SERVICE_INCLUDE_HIDDEN_EXACT_PATH';
        }
      } catch (ignoreServiceEnumeration) { }
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
      var marker = name === 'node.exe' ? coreSourceMarker(p.CommandLine) : null;
      var created = null;
      try {
        var stamp = String(p.CreationDate || '');
        // CIM_DATETIME is local wall time plus an explicit signed UTC offset
        // in minutes. Omitting that offset falsely reports PID reuse in KST.
        var ts = /^(\d{14})\.\d{6}([+-])(\d{3})$/.exec(stamp);
        if (ts) {
          var wallUtc = Date.UTC(Number(stamp.substring(0,4)),
            Number(stamp.substring(4,6))-1,Number(stamp.substring(6,8)),
            Number(stamp.substring(8,10)),Number(stamp.substring(10,12)),
            Number(stamp.substring(12,14)));
          var minutes = Number(ts[3]) * (ts[2]==='+'?1:-1);
          created = wallUtc-minutes*60000;
          if (!isFinite(created)) created = null;
        }
      } catch (ignoreCreated) { }
      // relativeRoot is limited to at most three sanitized path components.
      // No arbitrary command, secret, env value, or absolute candidate path.
      processes.push('{"pid":' + current + ',"parentPid":' + (parent===null?'null':parent) +
        ',"name":"' + (name==='node.exe'?'node.exe':'other') +
        '","sourceMarker":"' + (marker===null?'':marker.drive) +
        '","relativeRoot":"' + (marker===null?'':marker.relativeRoot.replace(/\\/g,'\\\\')) +
        '","createdAtMs":' +
        (created===null?'null':created) + '}');
    }
    var taskStateAfter = integer(task.State);
    done('{"ok":true,"taskStateBefore":' + (taskStateBefore===null?'null':taskStateBefore) +
      ',"taskStateAfter":' + (taskStateAfter===null?'null':taskStateAfter) +
      ',"runningInstances":' + observedInstances +
      ',"registeredRunningInstances":' + Number(running.Count) +
      ',"engineOrigin":"' + engineOrigin + '"' +
      ',"taskInstanceIds":[' + (instanceIds.length?'"'+instanceIds.join('","')+'"':'') + ']' +
      ',"engines":[' + engines.join(',') + '],"processes":['+
      processes.join(',') + ']}', 0);
  } catch (error) {
    done('{"ok":false,"code":"WMI_TASK_READ_UNAVAILABLE"}', 2);
  }
}());
