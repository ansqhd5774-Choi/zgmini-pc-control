' ZGMINI fixed, read-only Windows WMI process ancestry check.
' Args: the maintainer updater Node PID, existing Runner supervisor PID.
' Any missing process, WMI error or ambiguous ancestry returns UNKNOWN.
Option Explicit
On Error Resume Next

If WScript.Arguments.Count <> 2 Then
  WScript.Echo "UNKNOWN"
  WScript.Quit 2
End If
If Not IsNumeric(WScript.Arguments(0)) Or Not IsNumeric(WScript.Arguments(1)) Then
  WScript.Echo "UNKNOWN"
  WScript.Quit 2
End If

Dim ownPid, targetPid, svc, rows, item, parentPid, stepNo
ownPid = CLng(WScript.Arguments(0))
targetPid = CLng(WScript.Arguments(1))
If Err.Number <> 0 Or ownPid <= 0 Or targetPid <= 0 Then
  WScript.Echo "UNKNOWN"
  WScript.Quit 2
End If

Set svc = GetObject("winmgmts:\\.\root\cimv2")
If Err.Number <> 0 Then
  WScript.Echo "UNKNOWN"
  WScript.Quit 2
End If

For stepNo = 1 To 32
  If ownPid = targetPid Then
    WScript.Echo "DESCENDANT"
    WScript.Quit 0
  End If
  Err.Clear
  Set rows = svc.ExecQuery("SELECT ProcessId,ParentProcessId FROM Win32_Process WHERE ProcessId=" & CStr(ownPid))
  If Err.Number <> 0 Then
    WScript.Echo "UNKNOWN"
    WScript.Quit 2
  End If
  If rows.Count <> 1 Or Err.Number <> 0 Then
    WScript.Echo "UNKNOWN"
    WScript.Quit 2
  End If
  For Each item In rows
    parentPid = CLng(item.ParentProcessId)
  Next
  If Err.Number <> 0 Then
    WScript.Echo "UNKNOWN"
    WScript.Quit 2
  End If
  If parentPid = 0 Then
    WScript.Echo "INDEPENDENT"
    WScript.Quit 0
  End If
  ownPid = parentPid
Next

WScript.Echo "UNKNOWN"
WScript.Quit 2
