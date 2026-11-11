/*
 * #996 Win32 VOLUME GUID / FILE_ID_INFO read-only primitive.
 * Used only by fixed, authenticated original-PC A-grade inventory.
 * No executable entry point. No rename, delete, ACL, volume locking,
 * raw file content, reparse traversal or arbitrary user-specified path.
 */
using System;
using System.Text;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public static class ZGmini996VolumeReadOnly {
    const uint READ_ATTRIBUTES=0x80;
    const uint SHARE_ALL=0x7;
    const uint OPEN_EXISTING=3;
    const uint BACKUP_SEMANTICS=0x02000000;
    const uint OPEN_REPARSE_POINT=0x00200000;
    const uint ATTR_DIRECTORY=0x10;
    const uint ATTR_REPARSE=0x400;

    [StructLayout(LayoutKind.Sequential)]
    struct FileIdInfo {
        public ulong VolumeSerialNumber;
        [MarshalAs(UnmanagedType.ByValArray,SizeConst=16)]
        public byte[] FileId;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct FileAttributeTagInfo {
        public uint FileAttributes;
        public uint ReparseTag;
    }
    [DllImport("kernel32.dll",EntryPoint="GetVolumeNameForVolumeMountPointW",
        CharSet=CharSet.Unicode,SetLastError=true)]
    static extern bool MountVolume(string mountPoint,StringBuilder buffer,uint size);
    [DllImport("kernel32.dll",EntryPoint="CreateFileW",
        CharSet=CharSet.Unicode,SetLastError=true)]
    static extern SafeFileHandle Open(string filename,uint access,uint share,
        IntPtr security,uint creation,uint flags,IntPtr template);
    [DllImport("kernel32.dll",EntryPoint="GetFileInformationByHandleEx",SetLastError=true)]
    static extern bool ReadFileId(SafeFileHandle h,int kind,out FileIdInfo result,uint size);
    [DllImport("kernel32.dll",EntryPoint="GetFileInformationByHandleEx",SetLastError=true)]
    static extern bool ReadTag(SafeFileHandle h,int kind,out FileAttributeTagInfo result,uint size);
    [DllImport("kernel32.dll",EntryPoint="GetFileAttributesW",
        CharSet=CharSet.Unicode,SetLastError=true)]
    static extern uint Attributes(string filename);

    public static string VolumeGuid(string mountPoint) {
        var result=new StringBuilder(128);
        if(!MountVolume(mountPoint,result,128))
            throw new InvalidOperationException("VOLUME_GUID_UNAVAILABLE");
        return result.ToString().ToLowerInvariant();
    }

    public static string Identity(string directory) {
        uint attrs=Attributes(directory);
        if(attrs==uint.MaxValue) {
            int error=Marshal.GetLastWin32Error();
            if(error==2||error==3)return "ABSENT";
            throw new InvalidOperationException("VOLUME_DIRECTORY_UNREADABLE");
        }
        using(var handle=Open(directory,READ_ATTRIBUTES,SHARE_ALL,
              IntPtr.Zero,OPEN_EXISTING,BACKUP_SEMANTICS|OPEN_REPARSE_POINT,IntPtr.Zero)) {
            if(handle.IsInvalid)
                throw new InvalidOperationException("VOLUME_HANDLE_UNREADABLE");
            FileAttributeTagInfo tag;
            if(!ReadTag(handle,9,out tag,(uint)Marshal.SizeOf(typeof(FileAttributeTagInfo))) ||
               (tag.FileAttributes&ATTR_DIRECTORY)==0 ||
               (tag.FileAttributes&ATTR_REPARSE)!=0)
                throw new InvalidOperationException("VOLUME_REDIRECT_OR_TYPE_UNKNOWN");
            FileIdInfo id;
            if(!ReadFileId(handle,18,out id,(uint)Marshal.SizeOf(typeof(FileIdInfo))) ||
               id.FileId==null||id.FileId.Length!=16)
                throw new InvalidOperationException("VOLUME_FILE_ID_UNVERIFIED");
            return id.VolumeSerialNumber.ToString("x16")+":"+
                   BitConverter.ToString(id.FileId).Replace("-","").ToLowerInvariant();
        }
    }
}
