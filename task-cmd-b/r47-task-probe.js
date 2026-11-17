// Windows Script Host JScript 5.8. Fixed R47 Task read-only process probe.
// No process command lines, raw files, credentials or user input are printed.
(function(){
 try{
  var service=new ActiveXObject('Schedule.Service');
  service.Connect();
  var task=service.GetFolder('\\').GetTask('ZGMINI-PC-Theme-Nine-R47-Private');
  var instances=task.GetInstances(0).Count;
  var wmi=GetObject('winmgmts:root\\cimv2');
  var processes=wmi.ExecQuery('SELECT Name,CommandLine FROM Win32_Process');
  var iter=new Enumerator(processes),related=0,unknown=0;
  for(;!iter.atEnd();iter.moveNext()){
   var p=iter.item(),name=String(p.Name||'').toLowerCase();
   var relevant=name==='cmd.exe'||name==='wscript.exe'||
    name==='cscript.exe'||name==='node.exe';
   if(!relevant)continue;
   var command=p.CommandLine===null||typeof p.CommandLine==='undefined'?
    '':String(p.CommandLine).toLowerCase();
   if(command.indexOf('theme_nine_r47_recurring_private_update.cmd')!==-1||
      command.indexOf('theme-nine-r48')!==-1)related+=1;
   if(command==='')unknown+=1;
  }
  WScript.Echo('{"ok":true,"enabled":'+(task.Enabled?'true':'false')+
   ',"state":'+Number(task.State)+',"instances":'+Number(instances)+
   ',"relatedProcesses":'+related+',"unknownProcessLines":'+unknown+'}');
 }catch(e){
  WScript.Echo('{"ok":false,"code":"TASK_CMD_B_READONLY_PROBE_STOP"}');
  WScript.Quit(2);
 }
}());
