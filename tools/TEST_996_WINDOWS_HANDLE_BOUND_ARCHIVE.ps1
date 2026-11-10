# Isolated Windows TEMP fixture. No original-PC paths are accepted.
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Web.Extensions
  Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;
using System.Web.Script.Serialization;

public static class C996NativeDirectory {
  const uint ATTR_REPARSE=0x400, ATTR_DIRECTORY=0x10;
  const uint READ_ATTRIBUTES=0x80, DELETE=0x10000, GENERIC_READ=0x80000000;
  const uint SHARE_READ=1, SHARE_WRITE=2, OPEN_EXISTING=3;
  const uint BACKUP_SEMANTICS=0x02000000, OPEN_REPARSE_POINT=0x00200000;
  [StructLayout(LayoutKind.Sequential)] struct FT {public uint Low;public uint High;}
  [StructLayout(LayoutKind.Sequential)] struct INFO {
    public uint Attr;public FT Created;public FT Accessed;public FT Written;
    public uint Volume;public uint SizeHigh;public uint SizeLow;public uint Links;
    public uint IndexHigh;public uint IndexLow;
  }
  [StructLayout(LayoutKind.Sequential)] struct RENAME {
    public byte ReplaceIfExists;public IntPtr RootDirectory;
    public uint FileNameLength;public ushort FileName;
  }
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
  static extern SafeFileHandle CreateFileW(string name,uint access,uint share,
    IntPtr security,uint disposition,uint flags,IntPtr template);
  [DllImport("kernel32.dll",SetLastError=true)]
  static extern bool GetFileInformationByHandle(SafeFileHandle handle,out INFO info);
  [DllImport("kernel32.dll",SetLastError=true)]
  static extern bool SetFileInformationByHandle(SafeFileHandle handle,int cls,
    IntPtr buffer,uint length);
  static JavaScriptSerializer serializer=new JavaScriptSerializer();
  class Stop:Exception {public string Code;public int Native;public Stop(string c,int n=0){Code=c;Native=n;}}
  static void Need(bool ok,string code){if(!ok)throw new Stop(code);}
  static INFO Info(SafeFileHandle h){INFO i;if(!GetFileInformationByHandle(h,out i))throw new Stop("C996_NATIVE_IDENTITY_FAILED",Marshal.GetLastWin32Error());return i;}
  static string Identity(INFO i){return i.Volume.ToString("x8")+":"+(((ulong)i.IndexHigh<<32)|i.IndexLow).ToString("x16");}
  static string Sha(Stream s){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(s)).Replace("-","").ToLowerInvariant();}
  static SafeFileHandle OpenDir(string p,bool moving,bool readMoved=false){
    var h=CreateFileW(p,READ_ATTRIBUTES|(moving?DELETE:0),SHARE_READ|SHARE_WRITE|(readMoved?4u:0u),
      IntPtr.Zero,OPEN_EXISTING,BACKUP_SEMANTICS|OPEN_REPARSE_POINT,IntPtr.Zero);
    if(h.IsInvalid)throw new Stop("C996_NATIVE_DIRECTORY_OPEN_FAILED",Marshal.GetLastWin32Error());
    var i=Info(h);if((i.Attr&ATTR_REPARSE)!=0||(i.Attr&ATTR_DIRECTORY)==0){h.Dispose();throw new Stop("C996_NATIVE_REPARSE_OR_NOT_DIRECTORY");}return h;
  }
  static void HoldParents(string root,string p,List<SafeFileHandle> held){
    string at=Path.GetPathRoot(p);Need(!String.IsNullOrEmpty(at),"C996_NATIVE_PATH_INVALID");
    held.Add(OpenDir(at,false));
    string relative=p.Substring(at.Length);foreach(string part in relative.Split(Path.DirectorySeparatorChar)){
      if(part.Length==0)continue;at=Path.Combine(at,part);held.Add(OpenDir(at,false));
    }
  }
  static string PathChecked(string root,string p){
    Need(p!=null&&p.Length<512&&!p.StartsWith(@"\\")&&!p.Contains("/../"),"C996_NATIVE_PATH_INVALID");
    string f=Path.GetFullPath(p),r=Path.GetFullPath(root).TrimEnd('\\')+"\\";
    Need(f.StartsWith(r,StringComparison.OrdinalIgnoreCase)&&
      Path.GetPathRoot(f).Equals(Path.GetPathRoot(r),StringComparison.OrdinalIgnoreCase),"C996_NATIVE_ROOT_ESCAPE");return f;
  }
  static Dictionary<string,object> Capture(string p,SafeFileHandle dir,List<FileStream> streams){
    var initial=Info(dir);var names=Directory.GetFileSystemEntries(p);Array.Sort(names,StringComparer.OrdinalIgnoreCase);
    Need(names.Length>0&&names.Length<=32,"C996_NATIVE_FILE_SET_INVALID");
    var files=new SortedDictionary<string,object>(StringComparer.Ordinal);
    foreach(string file in names){
      string name=Path.GetFileName(file);Need(name.EndsWith(".json",StringComparison.Ordinal)&&!files.ContainsKey(name),"C996_NATIVE_FILE_NAME_INVALID");
      var h=CreateFileW(file,GENERIC_READ,SHARE_READ|4,IntPtr.Zero,OPEN_EXISTING,OPEN_REPARSE_POINT,IntPtr.Zero);
      if(h.IsInvalid)throw new Stop("C996_NATIVE_FILE_OPEN_FAILED",Marshal.GetLastWin32Error());
      var info=Info(h);if((info.Attr&(ATTR_REPARSE|ATTR_DIRECTORY))!=0||info.Links!=1){h.Dispose();throw new Stop("C996_NATIVE_FILE_REDIRECT_OR_LINK");}
      ulong size=((ulong)info.SizeHigh<<32)|info.SizeLow;Need(size>0&&size<=262144,"C996_NATIVE_FILE_SIZE_INVALID");
      var stream=new FileStream(h,FileAccess.Read);streams.Add(stream);string sha=Sha(stream);
      Need(Identity(Info(h))==Identity(info),"C996_NATIVE_FILE_IDENTITY_DRIFT");
      files.Add(name,new Dictionary<string,object>{{"identity",Identity(info)},{"sha256",sha},{"size",size}});
    }
    var again=Directory.GetFileSystemEntries(p);Array.Sort(again,StringComparer.OrdinalIgnoreCase);
    Need(String.Join("\n",names)==String.Join("\n",again)&&Identity(Info(dir))==Identity(initial),"C996_NATIVE_SNAPSHOT_RACE");
    return new Dictionary<string,object>{{"identity",Identity(initial)},{"files",files}};
  }
  static void SameSnapshot(Dictionary<string,object> current,Dictionary<string,object> expected){
    Need((string)current["identity"]==(string)expected["identity"],"C996_NATIVE_SOURCE_IDENTITY_DRIFT");
    var a=(SortedDictionary<string,object>)current["files"];var b=(Dictionary<string,object>)expected["files"];
    Need(a.Count==b.Count,"C996_NATIVE_SOURCE_FILE_SET_DRIFT");
    foreach(var entry in a){
      Need(b.ContainsKey(entry.Key),"C996_NATIVE_SOURCE_FILE_SET_DRIFT");
      var x=(Dictionary<string,object>)entry.Value;var y=(Dictionary<string,object>)b[entry.Key];
      Need((string)x["identity"]==(string)y["identity"]&&(string)x["sha256"]==(string)y["sha256"]&&
        Convert.ToUInt64(x["size"])==Convert.ToUInt64(y["size"]),"C996_NATIVE_SOURCE_CONTENT_DRIFT");
    }
  }
  public static string Execute(string raw){
    var held=new List<SafeFileHandle>();var streams=new List<FileStream>();SafeFileHandle sourceHandle=null;IntPtr buffer=IntPtr.Zero;
    try{
      Need(raw!=null&&raw.Length<65536,"C996_NATIVE_INPUT_INVALID");
      var args=serializer.Deserialize<Dictionary<string,object>>(raw);
      string op=(string)args["operation"],root=(string)args["root"];
      Need(op=="snapshot"||op=="move","C996_NATIVE_OPERATION_INVALID");
      string temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar);
      root=Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar);
      Need(String.Equals(Path.GetDirectoryName(root),temp,StringComparison.OrdinalIgnoreCase)&&
        System.Text.RegularExpressions.Regex.IsMatch(Path.GetFileName(root),@"\Azgmini-996-handle-fixture-[A-Za-z0-9]+\z")&&
        !root.StartsWith(@"E:\ZGmini\",StringComparison.OrdinalIgnoreCase),"C996_NATIVE_TEMP_FIXTURE_REQUIRED");
      string source=PathChecked(root,(string)args["source"]);
      Need(String.Equals(source,Path.Combine(root,"source"),StringComparison.OrdinalIgnoreCase),"C996_NATIVE_FIXED_SOURCE_REQUIRED"); HoldParents(root,Path.GetDirectoryName(source),held);
      sourceHandle=OpenDir(source,op=="move");
      var snap=Capture(source,sourceHandle,streams);
      if(op=="snapshot")return serializer.Serialize(new Dictionary<string,object>{{"ok",true},{"snapshot",snap}});
      string destination=PathChecked(root,(string)args["destination"]);
      Need(Path.GetDirectoryName(source).Equals(Path.GetDirectoryName(destination),StringComparison.OrdinalIgnoreCase),"C996_NATIVE_PARENT_MISMATCH");
      Need(String.Equals(destination,Path.Combine(root,"archive"),StringComparison.OrdinalIgnoreCase),"C996_NATIVE_FIXED_DESTINATION_REQUIRED"); SameSnapshot(snap,(Dictionary<string,object>)args["expected"]);
      string leaf=Path.GetFileName(destination);Need(leaf.Length>0&&!leaf.Contains(":"),"C996_NATIVE_DESTINATION_INVALID");
      // All ancestors and the common parent stay open without SHARE_DELETE.
      // Windows rejected RootDirectory+leaf; use an absolute NT name instead.
      var parent=held[held.Count-1];var parentBefore=Identity(Info(parent));
      byte[] bytes=System.Text.Encoding.Unicode.GetBytes(@"\??\"+destination);
      int nameOffset=Marshal.OffsetOf(typeof(RENAME),"FileName").ToInt32();
      int rootOffset=Marshal.OffsetOf(typeof(RENAME),"RootDirectory").ToInt32();
      int lenOffset=Marshal.OffsetOf(typeof(RENAME),"FileNameLength").ToInt32();
      int length=nameOffset+bytes.Length+2;buffer=Marshal.AllocHGlobal(length);
      for(int i=0;i<length;i++)Marshal.WriteByte(buffer,i,0);
      Marshal.WriteIntPtr(buffer,rootOffset,IntPtr.Zero);
      Marshal.WriteInt32(buffer,lenOffset,bytes.Length);Marshal.Copy(bytes,0,IntPtr.Add(buffer,nameOffset),bytes.Length);
      // Windows cannot rename this directory while child streams are open.
      // Close them after CAS; detect any namespace/content race in the postcheck.
      foreach(var stream in streams)stream.Dispose();streams.Clear();
      // Exercise the competing path operation in the exact pre-move window.
      bool competingRenameBlocked=false;
      try { Directory.Move(source,Path.Combine(root,"competing")); }
      catch(IOException) { competingRenameBlocked=true; }
      Need(competingRenameBlocked&&Directory.Exists(source)&&
        !Directory.Exists(Path.Combine(root,"competing")),"C996_NATIVE_COMPETING_RENAME_NOT_BLOCKED");
      if(!SetFileInformationByHandle(sourceHandle,3,buffer,(uint)length)){
        int error=Marshal.GetLastWin32Error();throw new Stop(error==183||error==80?"C996_NATIVE_DESTINATION_EXISTS":"C996_NATIVE_RENAME_UNCERTAIN",error);
      }
      Need(Identity(Info(sourceHandle))==(string)snap["identity"]&&Identity(Info(parent))==parentBefore,"C996_NATIVE_RENAME_IDENTITY_DRIFT");
      // Verify every original file identity and hash after the namespace move.
      foreach(var s in streams)s.Dispose();streams.Clear();
      using(var after=OpenDir(destination,false,true)){
        var post=Capture(destination,after,streams);SameSnapshot(post,(Dictionary<string,object>)args["expected"]);
        return serializer.Serialize(new Dictionary<string,object>{{"ok",true},{"snapshot",post},{"noReplace",true},{"sourceHandleBound",true},{"competingRenameBlocked",competingRenameBlocked},{"parentIdentity",parentBefore},{"namespacePowerLossDurabilityProven",false}});
      }
    }catch(Stop e){return serializer.Serialize(new Dictionary<string,object>{{"ok",false},{"code",e.Code},{"nativeError",e.Native}});}
    catch{return serializer.Serialize(new Dictionary<string,object>{{"ok",false},{"code","C996_NATIVE_STORAGE_UNCERTAIN"}});}
    finally{if(buffer!=IntPtr.Zero)Marshal.FreeHGlobal(buffer);foreach(var s in streams)s.Dispose();if(sourceHandle!=null)sourceHandle.Dispose();foreach(var h in held)h.Dispose();}
  }
}
'@ -ReferencedAssemblies 'System.Web.Extensions'
  $raw = [Console]::In.ReadToEnd()
  $result = [C996NativeDirectory]::Execute($raw)
  [Console]::Out.WriteLine($result)
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  [Console]::Out.WriteLine('{"ok":false,"code":"C996_NATIVE_BRIDGE_UNAVAILABLE"}')
  exit 2
}
