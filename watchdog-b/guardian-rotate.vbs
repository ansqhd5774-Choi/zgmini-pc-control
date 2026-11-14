' ZGMINI exact independent Watchdog Guardian activation.
' Only one WMI-attested Watchdog Node PID may be terminated; no /T, no
' Runner, Controller, Supervisor or maintenance receiver process is targeted.
Option Explicit
On Error Resume Next
Sub Deny()
 WScript.Echo "WATCHDOG_ROTATION_DENIED"
 WScript.Quit 5
End Sub
Function PidOk(value)
 PidOk=False
 If Not IsNumeric(value) Then Exit Function
 Err.Clear
 Dim number
 number=CLng(value)
 If Err.Number<>0 Then Exit Function
 PidOk=(number>0)
End Function
Function OnlyProcess(service,pid)
 Dim rows,one
 Err.Clear
 Set rows=service.ExecQuery("SELECT ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine,SessionId FROM Win32_Process WHERE ProcessId=" & CStr(pid))
 If Err.Number<>0 Then Set OnlyProcess=Nothing : Exit Function
 If rows.Count<>1 Or Err.Number<>0 Then Set OnlyProcess=Nothing : Exit Function
 For Each one In rows
  Set OnlyProcess=one
 Next
 If Err.Number<>0 Then Set OnlyProcess=Nothing
End Function
Function OwnerSid(item)
 Err.Clear
 Dim sid,code
 sid=""
 code=item.GetOwnerSid(sid)
 If Err.Number<>0 Or code<>0 Then OwnerSid="" Else OwnerSid=CStr(sid)
End Function
Function Created(item)
 Err.Clear
 Dim stringValue,re
 stringValue=CStr(item.CreationDate)
 If Err.Number<>0 Then Created="" : Exit Function
 Set re=New RegExp
 re.Pattern="^[0-9]{14}\.[0-9]{6}[+-][0-9]{3}$"
 If Not re.Test(stringValue) Then stringValue=""
 Created=stringValue
End Function
Function AgeSeconds(value)
 Err.Clear
 Dim timeValue,dateTime
 Set dateTime=CreateObject("WbemScripting.SWbemDateTime")
 dateTime.Value=value
 timeValue=dateTime.GetVarDate
 If Err.Number<>0 Then AgeSeconds=-1 : Exit Function
 AgeSeconds=DateDiff("s",timeValue,Now())
 If Err.Number<>0 Then AgeSeconds=-1
End Function
If WScript.Arguments.Count<>2 Then Deny
If UCase(CStr(WScript.Arguments(0)))<>"PROBE" And UCase(CStr(WScript.Arguments(0)))<>"ACTIVATE" Then Deny
If Not PidOk(WScript.Arguments(1)) Then Deny
Dim svc,watch,guardian,watchPid,guardianPid,nodePath,scriptPath
Dim startupPath,cmdExpected,watchBorn,guardianBorn,watchSid,guardianSid,elapsed,rc
watchPid=CLng(WScript.Arguments(1))
Err.Clear
Set svc=GetObject("winmgmts:\\.\root\cimv2")
If Err.Number<>0 Then Deny
Set watch=OnlyProcess(svc,watchPid)
If watch Is Nothing Then Deny
nodePath="e:\zgmini\runtime\node.exe"
scriptPath="e:\zgmini\automation\pc-watchdog\runner-watchdog.mjs"
cmdExpected=Chr(34) & nodePath & Chr(34) & " " & Chr(34) & scriptPath & Chr(34)
If LCase(Replace(CStr(watch.ExecutablePath),"/","\"))<>nodePath Then Deny
If LCase(Trim(CStr(watch.CommandLine)))<>cmdExpected Then Deny
watchBorn=Created(watch)
watchSid=OwnerSid(watch)
If watchBorn="" Or watchSid="" Then Deny
elapsed=AgeSeconds(watchBorn)
' Guardian resets its restart counter after 600 seconds of normal Watchdog
' runtime. A younger process must not be rotated.
If elapsed<600 Then Deny
If Not PidOk(watch.ParentProcessId) Then Deny
guardianPid=CLng(watch.ParentProcessId)
Set guardian=OnlyProcess(svc,guardianPid)
If guardian Is Nothing Then Deny
If Right(LCase(Replace(CStr(guardian.ExecutablePath),"/","\")),12)<>"\wscript.exe" Then Deny
startupPath=LCase(CreateObject("WScript.Shell").ExpandEnvironmentStrings("%APPDATA%")) & "\microsoft\windows\start menu\programs\startup\zgmini_pc_control.vbs"
If InStr(LCase(CStr(guardian.CommandLine)),startupPath)=0 Then Deny
guardianBorn=Created(guardian)
guardianSid=OwnerSid(guardian)
If guardianBorn="" Or guardianSid<>watchSid Or guardianBorn>watchBorn Then Deny
If CStr(guardian.SessionId)<>CStr(watch.SessionId) Then Deny
If Err.Number<>0 Then Deny
If UCase(CStr(WScript.Arguments(0)))="PROBE" Then WScript.Echo "WATCHDOG_ROTATION_VERIFIED" : WScript.Quit 0
' The WMI object was selected by exact PID+parent+creation+owner+commandline.
' Terminate this single watchdog only. Never use Taskkill /T or process tree.
Err.Clear
rc=watch.Terminate(0)
If Err.Number<>0 Or rc<>0 Then Deny
WScript.Echo "WATCHDOG_ROTATION_SIGNALLED"
WScript.Quit 0
