// #996: native .NET Framework, isolated-Windows, TEMP-only proof.
// This file never authorizes the production C operator or changes OS policy.
using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Security;
using System.Security.Cryptography;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Threading;

internal static class Program
{
    private const string JournalName = "acl-recovery.json";
    private const string JournalSchema = "ZGMINI_996_TEMP_ACL_RECOVERY_V1";
    private static readonly AccessControlSections Dacl = AccessControlSections.Access;
    private static readonly SecurityIdentifier Users = new SecurityIdentifier("S-1-5-32-545");
    private static readonly FileSystemAccessRule ReadRule = new FileSystemAccessRule(
        Users, FileSystemRights.ReadData, AccessControlType.Allow);
    private static readonly byte[] InitialBytes = Encoding.UTF8.GetBytes("{\"fixture\":true}");

    [DataContract]
    private sealed class Journal
    {
        [DataMember(Name = "schema")] public string Schema;
        [DataMember(Name = "testOnly")] public bool TestOnly;
        [DataMember(Name = "beforeHash")] public string BeforeHash;
        [DataMember(Name = "beforeDacl")] public string BeforeDacl;
    }

    private static string JsonEscape(string value)
    {
        if (value == null) return "null";
        return "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"")
            .Replace("\r", "\\r").Replace("\n", "\\n") + "\"";
    }

    private static string Hash(string file)
    {
        using (var sha = SHA256.Create())
        using (var data = File.OpenRead(file))
            return BitConverter.ToString(sha.ComputeHash(data)).Replace("-", "");
    }

    private static string ShaText(string value)
    {
        using (var sha = SHA256.Create())
            return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-", "");
    }

    private static bool IsReparse(string path)
    {
        return (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0;
    }

    private static void RefuseReparseAncestors(string dir)
    {
        for (var parent = new DirectoryInfo(dir); parent != null; parent = parent.Parent)
        {
            if (!parent.Exists || (parent.Attributes & FileAttributes.ReparsePoint) != 0)
                throw new InvalidOperationException("C996_SECURITY_PROOF_TEMP_REDIRECT");
        }
    }

    private static string TempRoot()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("COMPUTERNAME"),
            "DESKTOP-N62L0NG", StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(Environment.GetEnvironmentVariable("RUNNER_NAME"),
            "zgmini-handoff-ci-spare-01", StringComparison.OrdinalIgnoreCase) ||
            Directory.Exists(@"E:\ZGmini") || File.Exists(@"E:\ZGmini"))
            throw new InvalidOperationException("C996_SECURITY_PROOF_ISOLATION_REQUIRED");
        string temp = Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\');
        string volume = Path.GetPathRoot(temp);
        if (!Regex.IsMatch(volume, @"^[A-Za-z]:\\$") ||
            !string.Equals(volume, @"C:\", StringComparison.OrdinalIgnoreCase) ||
            Regex.IsMatch(temp, @"(^|[\\/])ZGmini([\\/]|$)", RegexOptions.IgnoreCase))
            throw new InvalidOperationException("C996_SECURITY_PROOF_UNSAFE_TEMP");
        var disk = new DriveInfo(volume);
        if (!disk.IsReady || disk.DriveType != DriveType.Fixed ||
            !(disk.DriveFormat == "NTFS" || disk.DriveFormat == "ReFS"))
            throw new InvalidOperationException("C996_SECURITY_PROOF_UNSUPPORTED_VOLUME");
        RefuseReparseAncestors(temp);
        return temp;
    }

    private static string Root(string temp, string given, bool mustExist)
    {
        string root = Path.GetFullPath(given).TrimEnd('\\');
        if (!string.Equals(Path.GetDirectoryName(root), temp,
            StringComparison.OrdinalIgnoreCase) ||
            !Regex.IsMatch(Path.GetFileName(root), @"^zgmini-996-acl-fixture-[a-f0-9]{32}$"))
            throw new InvalidOperationException("C996_SECURITY_PROOF_RECOVERY_ROOT_UNSAFE");
        if (mustExist)
        {
            if (!Directory.Exists(root) || IsReparse(root))
                throw new InvalidOperationException("C996_SECURITY_PROOF_RECOVERY_ROOT_REDIRECT");
        }
        else if (Directory.Exists(root) || File.Exists(root))
            throw new InvalidOperationException("C996_SECURITY_PROOF_TERMINATION_ROOT_UNSAFE");
        return root;
    }

    private static void AssertTarget(string target, string expectedHash)
    {
        if (IsReparse(Path.GetDirectoryName(target)) || IsReparse(target) ||
            !string.Equals(Hash(target), expectedHash, StringComparison.Ordinal))
            throw new InvalidOperationException("C996_SECURITY_PROOF_RECOVERY_SOURCE_DRIFT");
    }

    private static string UniqueTarget(string root, out bool sourcePresent, out bool archivePresent)
    {
        string source = Path.Combine(root, @"source\owner.json");
        string archive = Path.Combine(root, @"archive\owner.json");
        sourcePresent = File.Exists(source);
        archivePresent = File.Exists(archive);
        if (sourcePresent == archivePresent || Directory.Exists(Path.Combine(root,"source")) != sourcePresent ||
            Directory.Exists(Path.Combine(root,"archive")) != archivePresent)
            throw new InvalidOperationException("C996_SECURITY_PROOF_RECOVERY_PATH_AMBIGUOUS");
        return sourcePresent ? source : archive;
    }

    private static void SaveJournal(string filename, Journal journal)
    {
        using (var stream = new FileStream(filename, FileMode.CreateNew,
            FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
        {
            new DataContractJsonSerializer(typeof(Journal)).WriteObject(stream, journal);
            stream.Flush(true);
        }
    }

    private static Journal ReadJournal(string filename)
    {
        var info = new FileInfo(filename);
        if (!info.Exists || info.Length > 8192 || IsReparse(filename))
            throw new InvalidOperationException("C996_SECURITY_PROOF_JOURNAL_UNSAFE");
        Journal j;
        using (var stream = File.OpenRead(filename))
            j = (Journal)new DataContractJsonSerializer(typeof(Journal)).ReadObject(stream);
        if (j == null || j.Schema != JournalSchema || !j.TestOnly ||
            j.BeforeHash == null || !Regex.IsMatch(j.BeforeHash, "^[A-F0-9]{64}$") ||
            j.BeforeDacl == null || !j.BeforeDacl.StartsWith("D:", StringComparison.Ordinal) ||
            j.BeforeDacl.Length > 4096)
            throw new InvalidOperationException("C996_SECURITY_PROOF_JOURNAL_INVALID");
        return j;
    }

    private static bool Restore(string target, string expectedHash, string originalDacl)
    {
        AssertTarget(target, expectedHash);
        // .NET Framework recommends a fresh FileSecurity for applying saved SDDL.
        // Reusing the mutated target descriptor can preserve its added ACEs.
        var acl = new FileSecurity();
        acl.SetSecurityDescriptorSddlForm(originalDacl, Dacl);
        File.SetAccessControl(target, acl);
        string afterDacl = File.GetAccessControl(target).GetSecurityDescriptorSddlForm(Dacl);
        bool daclMatches = afterDacl == originalDacl;
        bool bytesMatch = Hash(target) == expectedHash;
        if (!daclMatches)
        {
            Console.Error.WriteLine("C996_SECURITY_PROOF_RESTORE_DACL_MISMATCH");
            try
            {
                var a = new RawSecurityDescriptor(originalDacl);
                var b = new RawSecurityDescriptor(afterDacl);
                Console.Error.WriteLine("C996_RESTORE_DIAG_V1 beforeHash=" + ShaText(originalDacl) +
                    " afterHash=" + ShaText(afterDacl) +
                    " beforeLength=" + originalDacl.Length + " afterLength=" + afterDacl.Length +
                    " beforeFlags=" + ((int)a.ControlFlags) + " afterFlags=" + ((int)b.ControlFlags) +
                    " beforeAceCount=" + (a.DiscretionaryAcl == null ? -1 : a.DiscretionaryAcl.Count) +
                    " afterAceCount=" + (b.DiscretionaryAcl == null ? -1 : b.DiscretionaryAcl.Count));
            }
            catch { Console.Error.WriteLine("C996_RESTORE_DIAG_UNAVAILABLE"); }
        }
        if (!bytesMatch) Console.Error.WriteLine("C996_SECURITY_PROOF_RESTORE_BYTES_MISMATCH");
        return daclMatches && bytesMatch;
    }

    private static int Recover(string root)
    {
        var journal = ReadJournal(Path.Combine(root, JournalName));
        bool source, archive;
        string target = UniqueTarget(root, out source, out archive);
        // Validate exact file bytes, path and journal before any ACL write.
        bool restored = Restore(target, journal.BeforeHash, journal.BeforeDacl);
        Console.WriteLine("{\"schema\":\"ZGMINI_996_TEMP_SECURITY_RECOVERY_V1\",\"scope\":\"ISOLATED_WINDOWS_TEMP_ONLY\",\"ok\":" +
            (restored ? "true" : "false") + ",\"recoveryAttempted\":true,\"aclRestored\":" +
            (restored ? "true" : "false") + ",\"pathDisposition\":\"" + (source ? "SOURCE" : "ARCHIVE") +
            "\",\"errorCode\":" + (restored ? "null" : JsonEscape("C996_SECURITY_PROOF_RESTORE_FAILED")) +
            ",\"executionAuthorized\":false,\"originalPcWrites\":0}");
        return restored ? 0 : 2;
    }

    private static int Run(string root, bool injected, bool preexisting, bool terminate, bool timeout)
    {
        string source = Path.Combine(root, "source");
        string archive = Path.Combine(root, "archive");
        Directory.CreateDirectory(source);
        string original = Path.Combine(source, "owner.json");
        File.WriteAllBytes(original, InitialBytes);
        if (preexisting)
        {
            var seed = File.GetAccessControl(original);
            seed.AddAccessRule(ReadRule);
            File.SetAccessControl(original, seed);
        }
        string hash = Hash(original);
        string before = File.GetAccessControl(original).GetSecurityDescriptorSddlForm(Dacl);
        SaveJournal(Path.Combine(root, JournalName), new Journal {
            Schema = JournalSchema, TestOnly = true, BeforeHash = hash, BeforeDacl = before
        });
        bool changed = false, already = false, restored = false, moved = false;
        bool lockedMoveBlocked = false, injectedRecovered = false;
        string error = null;
        FileStream handle = null;
        try
        {
            var acl = File.GetAccessControl(original);
            already = acl.GetAccessRules(true, false, typeof(SecurityIdentifier))
                .Cast<FileSystemAccessRule>().Any(r => r.IdentityReference.Equals(Users) &&
                    r.AccessControlType == AccessControlType.Allow &&
                    (r.FileSystemRights & FileSystemRights.ReadData) == FileSystemRights.ReadData);
            if (!already)
            {
                acl.AddAccessRule(ReadRule);
                File.SetAccessControl(original, acl);
            }
            changed = File.GetAccessControl(original).GetSecurityDescriptorSddlForm(Dacl) != before;
            if (!changed && !already)
                throw new InvalidOperationException("C996_SECURITY_PROOF_ACL_CHANGE_NOT_OBSERVED");
            if (terminate || timeout)
            {
                if (Environment.GetEnvironmentVariable("ZGMINI_996_TEMP_TERMINATION_TEST") != "1")
                    throw new InvalidOperationException("C996_SECURITY_PROOF_TERMINATION_NOT_AUTHORIZED");
                Console.WriteLine("{\"scope\":\"ISOLATED_WINDOWS_TEMP_ONLY\",\"fixtureRoot\":" +
                    JsonEscape(root) + ",\"executionAuthorized\":false,\"originalPcWrites\":0}");
                Console.Out.Flush();
                if (timeout) Thread.Sleep(45000);
                Environment.Exit(17);
            }
            if (injected) throw new InvalidOperationException("C996_SECURITY_PROOF_INJECTED_FAILURE");
            handle = new FileStream(original, FileMode.Open, FileAccess.Read, FileShare.Read);
            try { Directory.Move(source, archive); }
            catch (IOException) { lockedMoveBlocked = true; }
            if (!lockedMoveBlocked || !Directory.Exists(source))
                throw new InvalidOperationException("C996_SECURITY_PROOF_LOCKED_MOVE_NOT_BLOCKED");
            handle.Dispose();
            handle = null;
            Directory.Move(source, archive);
            moved = true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            injectedRecovered = injected && error.Contains("C996_SECURITY_PROOF_INJECTED_FAILURE");
        }
        finally
        {
            if (handle != null) handle.Dispose();
            try
            {
                bool src, dst;
                string target = UniqueTarget(root, out src, out dst);
                restored = Restore(target, hash, before);
                bool srcAgain, dstAgain;
                UniqueTarget(root, out srcAgain, out dstAgain);
                if (src != srcAgain || dst != dstAgain) restored = false;
                if (!restored) error = "C996_SECURITY_PROOF_RESTORE_FAILED";
            }
            catch { restored = false; error = "C996_SECURITY_PROOF_RESTORE_FAILED"; }
        }
        bool ok = restored && (changed || already) &&
            (injected ? injectedRecovered && !moved : moved && lockedMoveBlocked && error == null);
        bool sp, ap;
        try { UniqueTarget(root, out sp, out ap); }
        catch { sp = false; ap = false; }
        Console.WriteLine("{\"schema\":\"ZGMINI_996_TEMP_SECURITY_WINDOW_PROOF_V1\",\"scope\":\"ISOLATED_WINDOWS_TEMP_ONLY\",\"ok\":" +
            (ok ? "true" : "false") + ",\"aclChanged\":" + (changed ? "true" : "false") +
            ",\"aclAlreadyPresent\":" + (already ? "true" : "false") +
            ",\"aclRestored\":" + (restored ? "true" : "false") +
            ",\"lockedMoveBlocked\":" + (lockedMoveBlocked ? "true" : "false") +
            ",\"moveAfterCloseSucceeded\":" + (moved ? "true" : "false") +
            ",\"injectedFailureRecovered\":" + (injectedRecovered ? "true" : "false") +
            ",\"executionAuthorized\":false,\"originalPcWrites\":0,\"workflowPuts\":0,\"backlogWrites\":0," +
            "\"processTerminationRecoveryProven\":false,\"fixtureRoot\":" + JsonEscape(root) +
            ",\"pathDisposition\":\"" + (sp ? "SOURCE" : ap ? "ARCHIVE" : "AMBIGUOUS") +
            "\",\"errorCode\":" + JsonEscape(ok ? null : error) + "}");
        return ok ? 0 : 2;
    }

    private static int Main(string[] args)
    {
        try
        {
            if (!args.Contains("--test-only"))
                throw new InvalidOperationException("C996_SECURITY_PROOF_TEST_ONLY_REQUIRED");
            string temp = TempRoot();
            int index = Array.IndexOf(args, "--fixture-root");
            if (index < 0 || index + 1 >= args.Length)
                throw new InvalidOperationException("C996_SECURITY_PROOF_RECOVERY_ROOT_MISSING");
            bool recover = args.Contains("--recover-only");
            bool injected = args.Contains("--inject-failure");
            bool preexisting = args.Contains("--preexisting-read-rule");
            bool terminate = args.Contains("--simulate-child-termination");
            bool timeout = args.Contains("--simulate-child-timeout");
            if ((injected ? 1 : 0) + (terminate ? 1 : 0) + (timeout ? 1 : 0) > 1 ||
                (recover && (injected || preexisting || terminate || timeout)))
                throw new InvalidOperationException("C996_SECURITY_PROOF_FAILURE_MODE_CONFLICT");
            return recover ? Recover(Root(temp,args[index + 1],true)) :
                Run(Root(temp,args[index + 1],false),injected,preexisting,terminate,timeout);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 2;
        }
    }
}
