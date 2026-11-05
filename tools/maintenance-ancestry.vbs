' ZGMINI read-only Windows WMI proof. All missing/mismatched data fails closed.
' CAPTURE receiverPID: prove that a live login Startup WScript spawned it.
' VERIFY updaterPID supervisorPID receiverPID creationDate sessionId ownerSID:
'   stop at the positively attested receiver, never infer from a dead parent.
Option Explicit
On Error Resume Next

Sub Unknown()
 WScript.Echo "UNKNOWN"
 WScript.Quit 2
End Sub

Function ValidPid(v)
 ValidPid = False
 If Not IsNumeric(v) Then Exit Function
 Err.Clear
 Dim n
 n = CLng(v)
 If Err.Number <> 0 Then Exit Function
 ValidPid = (n > 0)
End Function

Function Proc(pid)
 Dim rows,item
 Err.Clear
 Set rows = svc.ExecQuery("SELECT ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine,SessionId FROM Win32_Process WHERE ProcessId=" & CStr(pid))
 If Err.Number <> 0 Then Set Proc=Nothing : Exit Function
 If rows.Count <> 1 Or Err.Number <> 0 Then Set Proc=Nothing : Exit Function
 For Each item In rows
  Set Proc=item
 Next
 If Err.Number <> 0 Then Set Proc=Nothing
End Function

Function SidOf(item)
 Dim sid,rc
 sid=""
 Err.Clear
 rc=item.GetOwnerSid(sid)
 If Err.Number <> 0 Or rc <> 0 Then SidOf="" : Exit Function
 SidOf=CStr(sid)
End Function

Function Born(item)
 Err.Clear
 Born=CStr(item.CreationDate)
 If Err.Number <> 0 Then Born="" : Exit Function
 Dim re
 Set re=New RegExp
 re.Pattern="^[0-9]{14}\.[0-9]{6}[+-][0-9]{3}$"
 If Not re.Test(Born) Or Err.Number <> 0 Then Born=""
End Function

Function Later(parentBorn,childBorn)
 ' DMTF timestamps use microseconds and timezone offsets. Comparing only
 ' seconds may accept a recycled PID within the SAME second. A different
 ' offset cannot be ordered by lexical comparison: fail closed instead.
 Later=True
 If Len(parentBorn)<>25 Or Len(childBorn)<>25 Then Exit Function
 If Right(parentBorn,4)<>Right(childBorn,4) Then Exit Function
 Later=(Left(parentBorn,21)>Left(childBorn,21))
End Function

Function Named(item, name)
 Dim actual
 actual=LCase(Replace(CStr(item.ExecutablePath),"/","\"))
 Named=(Right(actual,Len(name))=LCase(name))
End Function

Function ApprovedReceiver(item)
 Dim cmd,bin
 cmd=LCase(CStr(item.CommandLine))
 bin=LCase(Replace(CStr(item.ExecutablePath),"/","\"))
 ApprovedReceiver=(bin="e:\zgmini\runtime\node.exe" _
   And InStr(cmd,"e:\zgmini\automation\pc-maintenance\tools\maintenance-agent.mjs")>0 _
   And InStr(cmd,"--poll")>0)
End Function

Dim svc
Err.Clear
Set svc=GetObject("winmgmts:\\.\root\cimv2")
If Err.Number <> 0 Then Unknown

' R54_SCAN is read-only WMI observation. It never exposes CommandLine,
' tokens or process environment: only PID, parent and a scoped match flag.
' The caller requires this installed, approved script's exact file hash.
If WScript.Arguments.Count=1 And UCase(CStr(WScript.Arguments(0)))="R54_SCAN" Then
 Dim r54Rows,r54Item,r54Name,r54Cmd,r54Exe,r54Text,r54Flag
 Err.Clear
 Set r54Rows=svc.ExecQuery("SELECT ProcessId,ParentProcessId,Name,CommandLine,ExecutablePath FROM Win32_Process")
 If Err.Number <> 0 Then Unknown
 WScript.Echo "PID,PARENT,MATCH"
 For Each r54Item In r54Rows
  Err.Clear
  r54Name=LCase(CStr(r54Item.Name))
  r54Cmd=""
  r54Exe=""
  If Not IsNull(r54Item.CommandLine) Then r54Cmd=CStr(r54Item.CommandLine)
  If Not IsNull(r54Item.ExecutablePath) Then r54Exe=CStr(r54Item.ExecutablePath)
  If Err.Number <> 0 Then Unknown
  r54Text=LCase(r54Cmd & " " & r54Exe)
  r54Flag="0"
  If InStr(r54Text,"theme-nine-r54")>0 Or InStr(r54Text,"theme_nine_r54")>0 _
   Or InStr(r54Text,"theme-ten-r78")>0 Or InStr(r54Text,"theme-ten-r80")>0 _
   Or InStr(r54Text,"theme-ten-r79")>0 Or InStr(r54Text,"theme-ten-r81")>0 Then
   r54Flag="1"
  ElseIf (r54Name="node.exe" Or r54Name="cmd.exe" Or r54Name="cscript.exe" _
   Or r54Name="wscript.exe") And (r54Cmd="" Or r54Exe="") Then
   r54Flag="?"
  End If
  WScript.Echo CStr(CLng(r54Item.ProcessId)) & "," & CStr(CLng(r54Item.ParentProcessId)) & "," & r54Flag
  If Err.Number <> 0 Then Unknown
 Next
 If Err.Number <> 0 Then Unknown
 WScript.Quit 0
End If

If WScript.Arguments.Count=2 And UCase(CStr(WScript.Arguments(0)))="IDENTIFY" Then
 Dim existing,existingBorn,existingSid
 If Not ValidPid(WScript.Arguments(1)) Then Unknown
 Set existing=Proc(CLng(WScript.Arguments(1)))
 If existing Is Nothing Then Unknown
 If Not ApprovedReceiver(existing) Then Unknown
 existingBorn=Born(existing)
 existingSid=SidOf(existing)
 If existingBorn="" Or existingSid="" Then Unknown
 ' Identity only. The caller must match a previously captured origin proof.
 ' This mode must NEVER establish the origin of a new receiver.
 WScript.Echo "IDENTIFIED|" & existingBorn & "|" & CStr(existing.SessionId) & "|" & existingSid
 WScript.Quit 0
End If

If WScript.Arguments.Count=3 And UCase(CStr(WScript.Arguments(0)))="OPERATOR" Then
 Dim operatorPid,forbiddenPid,operatorItem,operatorSid,operatorSession,operatorBorn,operatorNext,k
 If Not ValidPid(WScript.Arguments(1)) Then Unknown
 If Not IsNumeric(WScript.Arguments(2)) Then Unknown
 operatorPid=CLng(WScript.Arguments(1))
 forbiddenPid=CLng(WScript.Arguments(2))
 Set operatorItem=Proc(operatorPid)
 If operatorItem Is Nothing Then Unknown
 operatorSid=SidOf(operatorItem)
 operatorSession=CStr(operatorItem.SessionId)
 operatorBorn=Born(operatorItem)
 If operatorSid="" Or operatorBorn="" Then Unknown
 For k=1 To 32
  If CLng(operatorItem.ProcessId)=forbiddenPid Then Unknown
  If Named(operatorItem,"\runner.listener.exe") Or Named(operatorItem,"\runner.worker.exe") Then Unknown
  If CStr(operatorItem.SessionId)<>operatorSession Or SidOf(operatorItem)<>operatorSid Then Unknown
  If Born(operatorItem)="" Or Later(Born(operatorItem),operatorBorn) Then Unknown
  If Named(operatorItem,"\explorer.exe") Then WScript.Echo "INDEPENDENT_OPERATOR" : WScript.Quit 0
  operatorNext=operatorItem.ParentProcessId
  operatorBorn=Born(operatorItem)
  If Not ValidPid(operatorNext) Then Unknown
  Set operatorItem=Proc(CLng(operatorNext))
  If operatorItem Is Nothing Then Unknown
 Next
 Unknown
End If

If WScript.Arguments.Count=2 And UCase(CStr(WScript.Arguments(0)))="CAPTURE" Then
 Dim receiver,launcher,ancestor,ownerSid,created,session,originPath
 Dim ancestorPid,childCreated,parentCreated,n,explorerFound
 If Not ValidPid(WScript.Arguments(1)) Then Unknown
 Set receiver=Proc(CLng(WScript.Arguments(1)))
 If receiver Is Nothing Then Unknown
 If Not ApprovedReceiver(receiver) Then Unknown
 created=Born(receiver)
 ownerSid=SidOf(receiver)
 session=CStr(receiver.SessionId)
 If created="" Or ownerSid="" Or Not ValidPid(receiver.ParentProcessId) Then Unknown
 Set launcher=Proc(CLng(receiver.ParentProcessId))
 If launcher Is Nothing Then Unknown
 originPath=LCase(CreateObject("WScript.Shell").ExpandEnvironmentStrings("%APPDATA%")) & "\microsoft\windows\start menu\programs\startup\zgmini_pc_maintenance.vbs"
 If Not Named(launcher,"\wscript.exe") Then Unknown
 If InStr(LCase(CStr(launcher.CommandLine)),originPath)=0 Then Unknown
 If SidOf(launcher)<>ownerSid Or CStr(launcher.SessionId)<>session Then Unknown
 If Born(launcher)="" Or Later(Born(launcher),created) Then Unknown
 ' Trace the WScript to a same-owner interactive Explorer before that ancestry
 ' disappears. A Runner intermediary and PID reuse are both disqualifying.
 ancestorPid=CLng(launcher.ParentProcessId)
 childCreated=Born(launcher)
 explorerFound=False
 For n=1 To 32
  If Not ValidPid(ancestorPid) Then Unknown
  Set ancestor=Proc(ancestorPid)
  If ancestor Is Nothing Then Unknown
  parentCreated=Born(ancestor)
  If parentCreated="" Or Later(parentCreated,childCreated) Then Unknown
  If CStr(ancestor.SessionId)<>session Or SidOf(ancestor)<>ownerSid Then Unknown
  If Named(ancestor,"\runner.listener.exe") Or Named(ancestor,"\runner.worker.exe") Then Unknown
  If Named(ancestor,"\explorer.exe") Then explorerFound=True : Exit For
  ancestorPid=CLng(ancestor.ParentProcessId)
  childCreated=parentCreated
 Next
 If Not explorerFound Then Unknown
 WScript.Echo "ATTESTED|" & created & "|" & session & "|" & ownerSid
 WScript.Quit 0
End If

If WScript.Arguments.Count=7 And UCase(CStr(WScript.Arguments(0)))="VERIFY" Then
 Dim ownPid,supervisorPid,receiverPid,expectedBorn,expectedSession,expectedSid
 Dim item,parent,parentPid,bornCurrent,bornParent,i
 If Not ValidPid(WScript.Arguments(1)) Or Not ValidPid(WScript.Arguments(2)) Or Not ValidPid(WScript.Arguments(3)) Then Unknown
 ownPid=CLng(WScript.Arguments(1))
 supervisorPid=CLng(WScript.Arguments(2))
 receiverPid=CLng(WScript.Arguments(3))
 expectedBorn=CStr(WScript.Arguments(4))
 expectedSession=CStr(WScript.Arguments(5))
 expectedSid=CStr(WScript.Arguments(6))
 If Len(expectedBorn)<14 Or Len(expectedSid)<8 Then Unknown
 For i=1 To 32
  If ownPid=supervisorPid Then WScript.Echo "DESCENDANT" : WScript.Quit 0
  Set item=Proc(ownPid)
  If item Is Nothing Then Unknown
  bornCurrent=Born(item)
  If bornCurrent="" Then Unknown
  If ownPid=receiverPid Then
   If Not ApprovedReceiver(item) Then Unknown
   If bornCurrent<>expectedBorn Or CStr(item.SessionId)<>expectedSession Or SidOf(item)<>expectedSid Then Unknown
   WScript.Echo "INDEPENDENT"
   WScript.Quit 0
  End If
  parentPid=CLng(item.ParentProcessId)
  If Not ValidPid(parentPid) Then Unknown
  Set parent=Proc(parentPid)
  If parent Is Nothing Then Unknown
  bornParent=Born(parent)
  If bornParent="" Or Later(bornParent,bornCurrent) Then Unknown
  ownPid=parentPid
 Next
End If
Unknown
