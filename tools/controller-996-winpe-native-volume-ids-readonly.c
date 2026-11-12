/*
 * #996 SOURCE-ONLY Win32/WinPE native 8-directory identity observation.
 *
 * No main(), no write/delete/rename/reboot/lock, no GitHub, no C-grade port.
 * A FUTURE trusted WinPE wrapper must authenticate a signed Owner manifest,
 * selected image, physical host, volume binding, current time, and output.
 * The supplied GUID/continuation UUID/serial are UNTRUSTED here.
 * A successful read of eight IDs is NOT proof of WinPE boot or Owner consent.
 */
#if defined(C996_ENABLE_C_GRADE_OPERATOR)
#error C996_VOLUME_ID_READER_IS_NOT_A_C_GRADE_OPERATOR
#endif
#if !defined(_WIN32) || !defined(_WIN64)
#error C996_VOLUME_ID_READER_REQUIRES_WINDOWS_X64
#endif
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00
#endif
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stddef.h>
#include <wchar.h>
#include <string.h>
#include <strsafe.h>

#define C996_FIXED_ID_COUNT 8
#define C996_FIXED_MAX_PATH 512
#define C996_FIXED_GUID_CHARS 49
#define C996_FIXED_FILE_ID_HEX 32

typedef struct c996_source_only_native_id {
  char fileId128[33];
  char volumeSerial[17];
  int isReparse;
} c996_source_only_native_id;

typedef struct c996_source_only_volume_observation {
  /* These are fixed names; no attacker-defined path table is accepted. */
  const char *fixedKey[C996_FIXED_ID_COUNT];
  c996_source_only_native_id directories[C996_FIXED_ID_COUNT];
  char volumeSerial[17];
  WCHAR untrustedVolumeGuid[C996_FIXED_GUID_CHARS + 1];
  int idsCollected; /* 8 only on success, otherwise 0 */
  int isSourceOnlyObservation;
  int winpeBootAuthenticated;
  int ownerSignatureVerified;
  int offlineClockTrusted;
  int volumeGuidAuthenticated;
  int cExecutionAuthorized;
  int operationalWrites;
} c996_source_only_volume_observation;

typedef enum c996_source_only_read_status {
  C996_NATIVE_ID_READ_BLOCKED = 0,
  C996_NATIVE_ID_READ_COMPLETE_UNTRUSTED = 1
} c996_source_only_read_status;

static const char * const c996_fixed_keys[C996_FIXED_ID_COUNT] = {
  "VOLUME_ROOT", "ZGMINI", "AUTOMATION", "MAINTENANCE", "LEASES",
  "OLD_C", "INSTALL", "CONTINUATION"
};
static const WCHAR * const c996_fixed_relative_paths[7] = {
  L"", L"ZGmini", L"ZGmini\\automation",
  L"ZGmini\\automation\\pc-maintenance",
  L"ZGmini\\automation\\pc-maintenance\\leases",
  L"ZGmini\\automation\\pc-maintenance\\leases\\controller-recovery",
  L"ZGmini\\automation\\pc-maintenance\\leases\\controller-install"
};
static const WCHAR c996_continuation_prefix[] =
  L"ZGmini\\automation\\pc-maintenance\\leases\\controller-recovery-continuation-";

static int c996_hex_digit(WCHAR c) {
  return (c >= L'0' && c <= L'9') ||
         (c >= L'a' && c <= L'f');
}
static int c996_valid_uuid(const WCHAR *uuid) {
  size_t i;
  if (!uuid || wcslen(uuid) != 36) return 0;
  for (i = 0; i < 36; ++i) {
    if (i == 8 || i == 13 || i == 18 || i == 23) {
      if (uuid[i] != L'-') return 0;
    } else if (!c996_hex_digit(uuid[i])) return 0;
  }
  /* Only new v4/v7 continuation IDs with RFC 4122 variant are allowed. */
  if ((uuid[14] != L'4' && uuid[14] != L'7') ||
      (uuid[19] != L'8' && uuid[19] != L'9' &&
       uuid[19] != L'a' && uuid[19] != L'b')) return 0;
  return 1;
}
/* Exactly \\?\Volume{8-4-4-4-12}\; no drive letters or suffixes. */
static int c996_valid_volume_guid(const WCHAR *guid) {
  static const WCHAR prefix[] = L"\\\\?\\Volume{";
  size_t i;
  if (!guid || wcslen(guid) != C996_FIXED_GUID_CHARS ||
      wcsncmp(guid,prefix,11) != 0 ||
      guid[47] != L'}' || guid[48] != L'\\') return 0;
  for (i=0; i<36; ++i) {
    WCHAR c=guid[11+i];
    if (i==8 || i==13 || i==18 || i==23) {
      if (c!=L'-') return 0;
    } else if (!c996_hex_digit(c)) return 0;
  }
  return 1;
}
static int c996_expected_serial(const char *hex, ULONGLONG *serial) {
  size_t i;
  ULONGLONG x=0;
  if (!hex || !serial || strlen(hex)!=16) return 0;
  for(i=0;i<16;++i) {
    unsigned char c=(unsigned char)hex[i];
    unsigned value;
    if(c>='0'&&c<='9') value=c-'0';
    else if(c>='a'&&c<='f') value=c-'a'+10u;
    else return 0;
    x=(x<<4)|value;
  }
  if(x==0) return 0;
  *serial=x;
  return 1;
}
static void c996_to_hex(const BYTE *bytes,size_t n,char *hex) {
  static const char digits[]="0123456789abcdef";
  size_t i;
  for(i=0;i<n;++i) {
    hex[2*i]=digits[bytes[i]>>4];
    hex[2*i+1]=digits[bytes[i]&15];
  }
  hex[2*n]='\0';
}
static void c996_serial_hex(ULONGLONG serial,char out[17]) {
  static const char digits[]="0123456789abcdef";
  int i;
  for(i=15;i>=0;--i) {
    out[i]=digits[(unsigned)(serial&15u)];
    serial>>=4;
  }
  out[16]='\0';
}

/*
 * Read attributes and 128-bit ID from a directory handle ONLY.
 * Reject any reparse-point component, wrong serial, missing directory,
 * partial/lost read, or duplicate FILE_ID_INFO before reporting success.
 */
static int c996_read_fixed_directory(
    const WCHAR *fullPath, ULONGLONG expectedSerial,
    c996_source_only_native_id *out) {
  HANDLE h=INVALID_HANDLE_VALUE;
  FILE_ATTRIBUTE_TAG_INFO tagInfo;
  FILE_ID_INFO fileInfo;
  if(!fullPath || !out) return 0;
  h=CreateFileW(fullPath,FILE_READ_ATTRIBUTES,
      FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE,
      NULL,OPEN_EXISTING,
      FILE_FLAG_BACKUP_SEMANTICS|FILE_FLAG_OPEN_REPARSE_POINT,NULL);
  if(h==INVALID_HANDLE_VALUE) return 0;
  ZeroMemory(&tagInfo,sizeof(tagInfo));
  ZeroMemory(&fileInfo,sizeof(fileInfo));
  if(!GetFileInformationByHandleEx(h,FileAttributeTagInfo,
        &tagInfo,(DWORD)sizeof(tagInfo)) ||
     !(tagInfo.FileAttributes&FILE_ATTRIBUTE_DIRECTORY) ||
      (tagInfo.FileAttributes&FILE_ATTRIBUTE_REPARSE_POINT) ||
     !GetFileInformationByHandleEx(h,FileIdInfo,
        &fileInfo,(DWORD)sizeof(fileInfo)) ||
      fileInfo.VolumeSerialNumber!=expectedSerial) {
    CloseHandle(h);
    return 0;
  }
  c996_to_hex(fileInfo.FileId.Identifier,16,out->fileId128);
  c996_serial_hex(fileInfo.VolumeSerialNumber,out->volumeSerial);
  out->isReparse=0;
  CloseHandle(h);
  return 1;
}

/* Caller must verify the exact JSON/bytes and trust evidence independently. */
c996_source_only_read_status c996_source_only_collect_eight_ids(
    const WCHAR *untrustedVolumeGuid,
    const char *untrustedVolumeSerial,
    const WCHAR *untrustedContinuationUuid,
    c996_source_only_volume_observation *out) {
  c996_source_only_volume_observation observation;
  WCHAR fullPath[C996_FIXED_MAX_PATH];
  WCHAR continuationPath[C996_FIXED_MAX_PATH];
  ULONGLONG expectedSerial;
  size_t i,j;
  HRESULT hr;
  if(!out) return C996_NATIVE_ID_READ_BLOCKED;
  ZeroMemory(out,sizeof(*out));
  ZeroMemory(&observation,sizeof(observation));
  observation.isSourceOnlyObservation=1;
  if(!c996_valid_volume_guid(untrustedVolumeGuid) ||
     !c996_expected_serial(untrustedVolumeSerial,&expectedSerial) ||
     !c996_valid_uuid(untrustedContinuationUuid))
    return C996_NATIVE_ID_READ_BLOCKED;
  for(i=0;i<C996_FIXED_ID_COUNT;++i) {
    const WCHAR *relative=c996_fixed_relative_paths[
       i<7 ? i : 0];
    ZeroMemory(fullPath,sizeof(fullPath));
    if(i==7) {
      hr=StringCchCopyW(continuationPath,C996_FIXED_MAX_PATH,
                        c996_continuation_prefix);
      if(FAILED(hr)) return C996_NATIVE_ID_READ_BLOCKED;
      hr=StringCchCatW(continuationPath,C996_FIXED_MAX_PATH,
                       untrustedContinuationUuid);
      if(FAILED(hr)) return C996_NATIVE_ID_READ_BLOCKED;
      relative=continuationPath;
    }
    hr=StringCchCopyW(fullPath,C996_FIXED_MAX_PATH,untrustedVolumeGuid);
    if(FAILED(hr)) return C996_NATIVE_ID_READ_BLOCKED;
    hr=StringCchCatW(fullPath,C996_FIXED_MAX_PATH,relative);
    if(FAILED(hr)) return C996_NATIVE_ID_READ_BLOCKED;
    observation.fixedKey[i]=c996_fixed_keys[i];
    if(!c996_read_fixed_directory(fullPath,expectedSerial,
                                 &observation.directories[i]))
      return C996_NATIVE_ID_READ_BLOCKED;
    /* Detect duplicated directory identities, not merely repeated names. */
    for(j=0;j<i;++j)
      if(strcmp(observation.directories[i].fileId128,
                observation.directories[j].fileId128)==0)
        return C996_NATIVE_ID_READ_BLOCKED;
  }
  c996_serial_hex(expectedSerial,observation.volumeSerial);
  hr=StringCchCopyW(observation.untrustedVolumeGuid,
                    C996_FIXED_GUID_CHARS + 1,untrustedVolumeGuid);
  if(FAILED(hr)) return C996_NATIVE_ID_READ_BLOCKED;
  observation.idsCollected=C996_FIXED_ID_COUNT;
  /* All trust fields remain zero, even after eight successful reads. */
  *out=observation;
  return C996_NATIVE_ID_READ_COMPLETE_UNTRUSTED;
}
