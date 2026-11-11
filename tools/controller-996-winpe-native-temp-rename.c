/*
 * #996 NATIVE WINDOWS TEMP RENAME PROOF CANDIDATE — NOT A C OPERATOR.
 *
 * This program is deliberately build-disabled unless the test-only macro is
 * explicitly defined. It has no production mode. It only renames a directory
 * called "source" to "archive" inside one pre-created random fixture under
 * the common queue PC's C: TEMP directory. It refuses an E:\ZGmini machine,
 * foreign PC identity, reparse-point final objects and arbitrary input paths.
 *
 * It does NOT verify Owner C consent, prove a hostile namespace confinement,
 * persist a recovery journal, or attest compatibility with a chosen WinPE.
 * Nothing here may be connected to the actual existing ZGMINI PC or its E:.
 */
#ifndef C996_NATIVE_TEMP_TEST_ONLY
#error "Production native #996 C operator is intentionally unavailable"
#endif
#ifndef _WIN64
#error "This TEMP-only test requires the pinned Windows x64 architecture"
#endif
#define WIN32_LEAN_AND_MEAN
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0602
#endif
#include <windows.h>
#include <winbase.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <wchar.h>
#include <strsafe.h>

/* Reuse the portable, no-I/O WinPE crash-reconciliation core. */
#include "controller-996-winpe-rename-reconcile.c"

#define C996_N MAX_PATH
#define C996_FIXTURE_PREFIX L"zgmini-996-winpe-fixture-"

static int c996_stop(const char *code)
{
    fprintf(stderr, "C996_NATIVE_TEMP_STOP:%s\n", code);
    return 2;
}

static bool c996_missing(DWORD code)
{
    return code == ERROR_FILE_NOT_FOUND || code == ERROR_PATH_NOT_FOUND ||
           code == ERROR_INVALID_DRIVE;
}

static bool c996_expected_machine(void)
{
    WCHAR machine[64];
    WCHAR runner[80];
    DWORD machine_length = (DWORD)(sizeof machine / sizeof machine[0]);
    DWORD runner_length;
    if (!GetComputerNameW(machine, &machine_length) ||
        _wcsicmp(machine, L"DESKTOP-N62L0NG") != 0)
        return false;
    runner_length = GetEnvironmentVariableW(L"RUNNER_NAME", runner,
                                            (DWORD)(sizeof runner / sizeof runner[0]));
    if (runner_length == 0 ||
        runner_length >= (DWORD)(sizeof runner / sizeof runner[0]) ||
        wcscmp(runner, L"zgmini-handoff-ci-spare-01") != 0)
        return false;

    /* A missing path must be proved to be absent, not access-denied. */
    if (GetFileAttributesW(L"E:\\ZGmini") != INVALID_FILE_ATTRIBUTES)
        return false;
    return c996_missing(GetLastError());
}

static bool c996_token(const WCHAR *s)
{
    if (s == NULL || wcslen(s) != 32) return false;
    for (unsigned int i = 0; i < 32; ++i)
        if (!((s[i] >= L'0' && s[i] <= L'9') ||
              (s[i] >= L'a' && s[i] <= L'f'))) return false;
    return true;
}

/* This is an isolation test root check, not proof against an actively hostile
 * filesystem. Every path component is checked; the native production tool
 * must instead use an independently attested offline volume and handoff. */
static bool c996_no_reparse_ancestors(const WCHAR *full_path)
{
    WCHAR cursor[C996_N];
    size_t count = wcslen(full_path);
    if (count < 3 || count >= C996_N || full_path[1] != L':' ||
        full_path[2] != L'\\') return false;
    /* GetTempPathW normally includes a trailing separator. Inspect its
     * directory name, not a potentially invalid trailing-separator spelling. */
    while (count > 3 && full_path[count - 1] == L'\\') --count;
    if (FAILED(StringCchCopyW(cursor, C996_N, full_path))) return false;
    for (size_t i = 3; i <= count; ++i) {
        if (cursor[i] == L'\\' || cursor[i] == L'\0') {
            WCHAR saved = cursor[i];
            DWORD attrs;
            cursor[i] = L'\0';
            attrs = GetFileAttributesW(cursor);
            cursor[i] = saved;
            if (attrs == INVALID_FILE_ATTRIBUTES ||
                (attrs & FILE_ATTRIBUTE_REPARSE_POINT) != 0 ||
                (attrs & FILE_ATTRIBUTE_DIRECTORY) == 0) return false;
        }
    }
    return true;
}

static HANDLE c996_open_dir(const WCHAR *name, DWORD desired, DWORD share)
{
    return CreateFileW(name, desired, share,
                       NULL, OPEN_EXISTING,
                       FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
                       NULL);
}

static bool c996_identity(HANDLE h, c996_file_identity *result)
{
    FILE_ID_INFO id;
    FILE_ATTRIBUTE_TAG_INFO tag;
    if (h == INVALID_HANDLE_VALUE || result == NULL ||
        !GetFileInformationByHandleEx(h, FileAttributeTagInfo, &tag, sizeof tag) ||
        (tag.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) == 0 ||
        (tag.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0 ||
        !GetFileInformationByHandleEx(h, FileIdInfo, &id, sizeof id))
        return false;
    result->exists = true;
    result->volume_serial = (uint64_t)id.VolumeSerialNumber;
    memcpy(&result->file_id_low, id.FileId.Identifier, sizeof(uint64_t));
    memcpy(&result->file_id_high, id.FileId.Identifier + sizeof(uint64_t),
           sizeof(uint64_t));
    return (result->file_id_low | result->file_id_high) != UINT64_C(0);
}

int wmain(int argc, WCHAR **argv)
{
    WCHAR temp[C996_N], root[C996_N], source[C996_N], archive[C996_N];
    DWORD got;
    HANDLE root_handle = INVALID_HANDLE_VALUE;
    HANDLE source_handle = INVALID_HANDLE_VALUE;
    HANDLE archive_handle = INVALID_HANDLE_VALUE;
    c996_file_identity root_id = {0}, source_id = {0}, archive_id = {0};
    FILE_RENAME_INFO *rename_info = NULL;
    const WCHAR *new_leaf = L"archive";
    size_t leaf_bytes = wcslen(new_leaf) * sizeof(WCHAR);
    size_t info_bytes = offsetof(FILE_RENAME_INFO, FileName) + leaf_bytes +
                        sizeof(WCHAR);
    int outcome = 2;

    if (argc != 3 || wcscmp(argv[1], L"--test-token") != 0 ||
        !c996_token(argv[2])) return c996_stop("INVALID_TEST_ARGUMENT");
    if (!c996_expected_machine()) return c996_stop("WRONG_MACHINE_OR_E_PRESENT");
    got = GetTempPathW(C996_N, temp);
    if (got == 0 || got >= C996_N ||
        _wcsnicmp(temp, L"C:\\", 3) != 0 ||
        !c996_no_reparse_ancestors(temp))
        return c996_stop("TEMP_ROOT_UNTRUSTED");

    if (FAILED(StringCchPrintfW(root, C996_N, L"%s%s%s", temp,
                                 C996_FIXTURE_PREFIX, argv[2])) ||
        FAILED(StringCchPrintfW(source, C996_N, L"%s\\source", root)) ||
        FAILED(StringCchPrintfW(archive, C996_N, L"%s\\archive", root)) ||
        !c996_no_reparse_ancestors(root) ||
        !c996_no_reparse_ancestors(source))
        return c996_stop("FIXTURE_UNSAFE");

    root_handle = c996_open_dir(root, FILE_READ_ATTRIBUTES | FILE_TRAVERSE,
                                FILE_SHARE_READ | FILE_SHARE_WRITE);
    source_handle = c996_open_dir(source, DELETE | FILE_READ_ATTRIBUTES,
                                  FILE_SHARE_READ | FILE_SHARE_WRITE);
    if (!c996_identity(root_handle, &root_id) ||
        !c996_identity(source_handle, &source_id) ||
        root_id.volume_serial != source_id.volume_serial) {
        outcome = c996_stop("SOURCE_IDENTITY_UNVERIFIED");
        goto done;
    }
    /* An existence check is diagnostic only. ReplaceIfExists = FALSE is the
     * actual no-clobber enforcement against a late destination creation. */
    if (GetFileAttributesW(archive) != INVALID_FILE_ATTRIBUTES ||
        !c996_missing(GetLastError())) {
        outcome = c996_stop("DESTINATION_EXISTS_OR_UNKNOWN");
        goto done;
    }

    if (info_bytes < sizeof(FILE_RENAME_INFO)) info_bytes = sizeof(FILE_RENAME_INFO);
    if (info_bytes > UINT32_MAX) {
        outcome = c996_stop("RENAME_INFO_TOO_LARGE");
        goto done;
    }
    rename_info = (FILE_RENAME_INFO *)calloc(1, info_bytes);
    if (rename_info == NULL) {
        outcome = c996_stop("OUT_OF_MEMORY");
        goto done;
    }
    rename_info->ReplaceIfExists = FALSE;
    rename_info->RootDirectory = root_handle;
    rename_info->FileNameLength = (DWORD)leaf_bytes;
    memcpy(rename_info->FileName, new_leaf, leaf_bytes);
    if (!SetFileInformationByHandle(source_handle, FileRenameInfo,
                                    rename_info, (DWORD)info_bytes)) {
        outcome = c996_stop("RENAME_DENIED_OR_COLLISION");
        goto done;
    }

    /* The source handle still has DELETE access to this SAME file identity.
     * The verification open must share DELETE to satisfy Windows' symmetric
     * share checks. The original held source handle itself still does NOT
     * share DELETE, preventing a competing DELETE open in this test window. */
    archive_handle = c996_open_dir(archive, FILE_READ_ATTRIBUTES,
                                   FILE_SHARE_READ | FILE_SHARE_WRITE |
                                   FILE_SHARE_DELETE);
    if (!c996_identity(archive_handle, &archive_id) ||
        c996_resolve_rename((c996_file_identity){0}, archive_id, source_id) !=
            C996_RENAME_DONE ||
        GetFileAttributesW(source) != INVALID_FILE_ATTRIBUTES ||
        !c996_missing(GetLastError())) {
        /* Rename may have succeeded. This is UNCERTAIN, not rolled back. */
        outcome = c996_stop("RENAME_RESULT_UNKNOWN");
        goto done;
    }
    puts("C996_NATIVE_TEMP_RENAMED_AND_ID_VERIFIED");
    outcome = 0;
done:
    free(rename_info);
    if (archive_handle != INVALID_HANDLE_VALUE) CloseHandle(archive_handle);
    if (source_handle != INVALID_HANDLE_VALUE) CloseHandle(source_handle);
    if (root_handle != INVALID_HANDLE_VALUE) CloseHandle(root_handle);
    return outcome;
}
