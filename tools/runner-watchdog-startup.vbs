' User-login guardian. Keeps the watcher recoverable even if node.exe exits.
Option Explicit
Dim shell, files, command, result, failures, started, marker
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
command = Chr(34) & "E:\ZGmini\runtime\node.exe" & Chr(34) & " " & Chr(34) & "E:\ZGmini\automation\pc-watchdog\runner-watchdog.mjs" & Chr(34)
failures = 0
Do
  If Not files.FileExists("E:\ZGmini\automation\pc-watchdog\PAUSE") Then
    started = Now
    result = shell.Run(command, 0, True)
    If result <> 10 Then
      If DateDiff("s", started, Now) >= 600 Then failures = 0
      failures = failures + 1
    End If
    If failures >= 3 Then
      Set marker = files.CreateTextFile("E:\ZGmini\automation\pc-watchdog\GUARDIAN_STOP.txt", True)
      marker.WriteLine "BLOCKED_WATCHDOG_RESTART_LIMIT"
      marker.Close
      WScript.Quit 1
    End If
  End If
  WScript.Sleep 30000
Loop
