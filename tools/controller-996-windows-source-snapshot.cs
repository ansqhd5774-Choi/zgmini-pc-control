using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;

// The caller must obtain pins from an independently trusted approval.
// NT sharing restrictions apply across processes, including the same user.
public sealed class Zgmini996WindowsSourceSnapshot : IDisposable
{
    [StructLayout(LayoutKind.Sequential)]
    private struct FileInfo {
        public uint Attributes;
        public System.Runtime.InteropServices.ComTypes.FILETIME Creation, Access, Write;
        public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string path, uint access, uint share,
        IntPtr security, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInfo info);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint GetDriveTypeW([MarshalAs(UnmanagedType.LPWStr)] string root);

    private readonly Dictionary<string, SafeFileHandle> directories =
        new Dictionary<string, SafeFileHandle>(StringComparer.OrdinalIgnoreCase);
    private readonly List<FileStream> files = new List<FileStream>();
    private bool disposed;

    private static SafeFileHandle Open(string path, bool directory)
    {
        // OPEN_REPARSE_POINT prevents following the final component. All
        // ancestors have already been opened and pinned before opening a child.
        var handle = CreateFileW(path, directory ? 0x80u : 0x80000000u,
            directory ? 3u : 1u, IntPtr.Zero, 3u,
            0x00200000u | (directory ? 0x02000000u : 0u), IntPtr.Zero);
        FileInfo info;
        if (handle.IsInvalid || !GetFileInformationByHandle(handle, out info)) {
            int error = Marshal.GetLastWin32Error();
            handle.Dispose();
            throw new IOException("C996_SNAPSHOT_OPEN_FAILED_" + error);
        }
        if ((info.Attributes & 0x400) != 0 ||
            ((info.Attributes & 0x10) != 0) != directory ||
            (!directory && (info.Links != 1 || info.SizeHigh != 0 || info.SizeLow > 16000000))) {
            handle.Dispose();
            throw new IOException("C996_SNAPSHOT_ENTRY_UNSAFE");
        }
        return handle;
    }

    public Zgmini996WindowsSourceSnapshot(IDictionary<string, string> expected)
    {
        if (expected == null || expected.Count == 0 || expected.Count > 32)
            throw new ArgumentException("C996_SNAPSHOT_PIN_SET_INVALID");
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try {
            foreach (var entry in expected) {
                string absolute = Path.GetFullPath(entry.Key);
                string root = Path.GetPathRoot(absolute);
                if (root.Length != 3 || GetDriveTypeW(root) != 3 ||
                    !String.Equals(absolute, entry.Key, StringComparison.OrdinalIgnoreCase) ||
                    absolute.Substring(root.Length).IndexOf(':') >= 0 ||
                    !seen.Add(absolute) || entry.Value == null ||
                    !System.Text.RegularExpressions.Regex.IsMatch(entry.Value, "\\A[a-f0-9]{64}\\z"))
                    throw new ArgumentException("C996_SNAPSHOT_PIN_INVALID");
                string parent = Path.GetDirectoryName(absolute);
                string current = root;
                PinDirectory(current);
                foreach (string component in parent.Substring(root.Length).Split('\\')) {
                    if (component.Length == 0) continue;
                    if (component.TrimEnd(' ', '.') != component)
                        throw new ArgumentException("C996_SNAPSHOT_PATH_ALIAS");
                    current = Path.Combine(current, component);
                    PinDirectory(current);
                }
                string leaf = Path.GetFileName(absolute);
                if (leaf.TrimEnd(' ', '.') != leaf)
                    throw new ArgumentException("C996_SNAPSHOT_PATH_ALIAS");
                var handle = Open(absolute, false);
                FileStream stream;
                try { stream = new FileStream(handle, FileAccess.Read); }
                catch { handle.Dispose(); throw; }
                files.Add(stream);
                using (var sha = SHA256.Create()) {
                    string observed = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
                    if (observed != entry.Value)
                        throw new IOException("C996_SNAPSHOT_SHA_MISMATCH");
                }
                stream.Position = 0;
            }
        } catch {
            Dispose();
            throw;
        }
    }

    private void PinDirectory(string path)
    {
        if (!directories.ContainsKey(path)) directories.Add(path, Open(path, true));
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        foreach (var stream in files) stream.Dispose();
        foreach (var handle in directories.Values) handle.Dispose();
    }
}
