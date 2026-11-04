// Windows Script Host JScript 5.8. This file is read-only and must run via
// cscript.exe //NoLogo using a fixed checked-out control-repo path.
// It NEVER prints a process command line or secret; only numeric evidence.
// Task Scheduler COM gives language-independent state and running instances.
(function () {
  try {
    var service = new ActiveXObject('Schedule.Service');
    service.Connect();
    var task = service.GetFolder('\\').GetTask('ZGMINI-PC-Local-Core');
    var instances = task.GetInstances(0).Count;
    var related = 0;
    var unknown = 0;
    var wmi = GetObject('winmgmts:root\\cimv2');
    var processes = wmi.ExecQuery("SELECT ProcessId,CommandLine FROM Win32_Process WHERE Name='node.exe' OR Name='cmd.exe' OR Name='cscript.exe' OR Name='wscript.exe'");
    var iterator = new Enumerator(processes);
    for (; !iterator.atEnd(); iterator.moveNext()) {
      var process = iterator.item();
      // Accessible process CommandLine must be inspectable. The Core task can
      // spawn child Node/CMD, so do not infer drain from Task.State alone.
      if (process.CommandLine === null || typeof process.CommandLine === 'undefined') {
        unknown += 1;
        continue;
      }
      var command = String(process.CommandLine).toLowerCase();
      // No E: prefix requirement: C: compatibility junctions, VBS dispatchers,
      // and legacy paths may point at the same Core process. Over-detection
      // safely delays installation; under-detection would race live Core.
      if (command.indexOf('local-cycle.mjs') !== -1 ||
          command.indexOf('run-local.mjs') !== -1 ||
          (command.indexOf('zgmini') !== -1 &&
           (command.indexOf('pc-core') !== -1 || command.indexOf('pc-writer') !== -1))) {
        related += 1;
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
    WScript.Echo('{"ok":false,"code":"R17_B_WINDOWS_PROBE_STOP"}');
    WScript.Quit(2);
  }
}());
