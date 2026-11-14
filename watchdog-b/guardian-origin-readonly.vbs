' Read-only first-fail classification for #1381. No process stop, no WMI
' Terminate method, no command-line/SID/PID/identity string in output.
Option Explicit
On Error Resume Next
Dim svc,pid,watch,guardian,flags,values,i,textOut,cmd,line
Dim nodePath,scriptPath,expected,startup,wpid,born,guardBorn
Dim nSid,gSid,dt,age
flags=Array("WATCH_PRESENT","NODE_PATH","COMMAND_EXACT","COMMAND_CONTAINS", _
 "PARENT_PRESENT","PARENT_WSCRIPT","PARENT_STARTUP","OWNER_SID", _
 "SESSION","PARENT_BEFORE","AGE_600")
ReDim values(UBound(flags))
For i=0 To UBound(values)
 values(i)="0"
Next
Function Proc(id)
 Dim rows,item
 Err.Clear
 Set rows=svc.ExecQuery("SELECT ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine,SessionId FROM Win32_Process WHERE ProcessId=" & CStr(id))
 If Err.Number<>0 Then Set Proc=Nothing : Exit Function
 If rows.Count<>1 Or Err.Number<>0 Then Set Proc=Nothing : Exit Function
 For Each item In rows
  Set Proc=item
 Next
 If Err.Number<>0 Then Set Proc=Nothing
End Function
Function Sid(item)
 Dim val,rc
 val=""
 Err.Clear
 rc=item.GetOwnerSid(val)
 If Err.Number<>0 Or rc<>0 Then Sid="" Else Sid=CStr(val)
End Function
Function SinceCreated(item)
 Dim timer
 Err.Clear
 Set timer=CreateObject("WbemScripting.SWbemDateTime")
 timer.Value=CStr(item.CreationDate)
 SinceCreated=DateDiff("s",timer.GetVarDate,Now())
 If Err.Number<>0 Then SinceCreated=-1
End Function
Sub Report()
 Dim out,j
 out="PROOF"
 For j=0 To UBound(flags)
  out=out & "|" & flags(j) & "=" & values(j)
 Next
 WScript.Echo out
 WScript.Quit 0
End Sub
If WScript.Arguments.Count<>1 Then WScript.Echo "INVALID_PID" : WScript.Quit 2
If Not IsNumeric(WScript.Arguments(0)) Then WScript.Echo "INVALID_PID" : WScript.Quit 2
Err.Clear
pid=CLng(WScript.Arguments(0))
If Err.Number<>0 Or pid<=0 Then WScript.Echo "INVALID_PID" : WScript.Quit 2
Err.Clear
Set svc=GetObject("winmgmts:\\.\root\cimv2")
If Err.Number<>0 Then WScript.Echo "WMI_UNAVAILABLE" : WScript.Quit 2
Set watch=Proc(pid)
If watch Is Nothing Then Report
values(0)="1"
nodePath="e:\zgmini\runtime\node.exe"
scriptPath="e:\zgmini\automation\pc-watchdog\runner-watchdog.mjs"
expected=Chr(34) & nodePath & Chr(34) & " " & Chr(34) & scriptPath & Chr(34)
If LCase(Replace(CStr(watch.ExecutablePath),"/","\"))=nodePath Then values(1)="1"
cmd=LCase(Trim(CStr(watch.CommandLine)))
If cmd=expected Then values(2)="1"
If InStr(cmd,scriptPath)>0 Then values(3)="1"
age=SinceCreated(watch)
If age>=600 Then values(10)="1"
wpid=watch.ParentProcessId
If Not IsNumeric(wpid) Then Report
If CLng(wpid)<=0 Then Report
Set guardian=Proc(CLng(wpid))
If guardian Is Nothing Then Report
values(4)="1"
If Right(LCase(Replace(CStr(guardian.ExecutablePath),"/","\")),12)="\wscript.exe" Then values(5)="1"
startup=LCase(CreateObject("WScript.Shell").ExpandEnvironmentStrings("%APPDATA%")) & "\microsoft\windows\start menu\programs\startup\zgmini_pc_control.vbs"
If InStr(LCase(CStr(guardian.CommandLine)),startup)>0 Then values(6)="1"
nSid=Sid(watch):gSid=Sid(guardian)
If nSid<>"" And nSid=gSid Then values(7)="1"
If CStr(watch.SessionId)=CStr(guardian.SessionId) Then values(8)="1"
born=CStr(watch.CreationDate):guardBorn=CStr(guardian.CreationDate)
If Len(born)>=21 And Len(guardBorn)>=21 And guardBorn<=born Then values(9)="1"
Report
