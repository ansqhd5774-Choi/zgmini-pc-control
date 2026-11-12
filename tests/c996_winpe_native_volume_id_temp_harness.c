/*
 * #996 ISOLATED WINDOWS C: TEMP READ-ONLY native FileIdInfo harness.
 * This file is NOT a WinPE or production C operator. It has no writer, rename,
 * cleanup, reboot, volume mount, GitHub or Owner approval functionality.
 */
#ifndef C996_NATIVE_VOLUME_ID_TEMP_HARNESS_ONLY
#error C996_NATIVE_VOLUME_ID_TEMP_HARNESS_NOT_FOR_PRODUCTION
#endif
#ifndef _WIN64
#error C996_NATIVE_VOLUME_ID_TEMP_HARNESS_X64_ONLY
#endif
#if defined(C996_ENABLE_C_GRADE_OPERATOR)
#error C996_NATIVE_VOLUME_ID_TEMP_HARNESS_C_FORBIDDEN
#endif
#include "../tools/controller-996-winpe-native-volume-ids-readonly.c"
#include <stdio.h>
#include <wchar.h>

static int c996_is_isolated_pc(void){
  WCHAR name[80];
  WCHAR runner[100];
  DWORD length=(DWORD)(sizeof(name)/sizeof(name[0]));
  DWORD n;
  DWORD attrs;
  if(!GetComputerNameW(name,&length) ||
     wcscmp(name,L"DESKTOP-N62L0NG")!=0) { puts("C996_TEMP_GUARD_HOST_ID"); return 0; }
  n=GetEnvironmentVariableW(L"RUNNER_NAME",runner,
                             (DWORD)(sizeof(runner)/sizeof(runner[0])));
  if(n==0||n>=sizeof(runner)/sizeof(runner[0])||
     wcscmp(runner,L"zgmini-handoff-ci-spare-01")!=0) { puts("C996_TEMP_GUARD_RUNNER_ID"); return 0; }
  attrs=GetFileAttributesW(L"E:\\ZGmini");
  if(attrs!=INVALID_FILE_ATTRIBUTES){ puts("C996_TEMP_GUARD_OPERATIONAL_ROOT_VISIBLE"); return 0; }
  {DWORD err=GetLastError();
   if(err==ERROR_FILE_NOT_FOUND||err==ERROR_PATH_NOT_FOUND||err==ERROR_INVALID_DRIVE)
     return 1;
   puts("C996_TEMP_GUARD_OPERATIONAL_ROOT_UNVERIFIED");
   return 0;
  }
}
static int c996_check_temp_path(const WCHAR *input,WCHAR full[512]){
  WCHAR temp[512];
  size_t tempLength;
  DWORD n;
  const WCHAR *relative;
  const WCHAR *separator;
  const WCHAR *leaf;
  if(!input){ puts("C996_TEMP_GUARD_INPUT_MISSING"); return 0; }
  n=GetTempPathW(512,temp);
  if(n==0||n>=512){ puts("C996_TEMP_GUARD_TEMP_ROOT_UNKNOWN"); return 0; }
  if((temp[0]!=L'C'&&temp[0]!=L'c')||temp[1]!=L':'||
     temp[2]!=L'\\'){ puts("C996_TEMP_GUARD_TEMP_NOT_C"); return 0; }
  n=GetFullPathNameW(input,512,full,NULL);
  if(n==0||n>=512){ puts("C996_TEMP_GUARD_PATH_CANONICAL_UNAVAILABLE"); return 0; }
  tempLength=wcslen(temp);
  if(_wcsnicmp(full,temp,tempLength)!=0){ puts("C996_TEMP_GUARD_TEMP_ROOT_MISMATCH"); return 0; }
  relative=full+tempLength;
  if(wcsncmp(relative,L"zgmini-996-native-reader-fixture-",33)!=0){
    puts("C996_TEMP_GUARD_FIXTURE_PREFIX_MISSING"); return 0;
  }
  separator=wcschr(relative,L'\\');
  if(!separator||separator==relative||separator-relative>110){
    puts("C996_TEMP_GUARD_FIXTURE_NAME_INVALID"); return 0;
  }
  leaf=separator+1;
  if(wcscmp(leaf,L"source")!=0&&wcscmp(leaf,L"archive")!=0){
    puts("C996_TEMP_GUARD_FIXED_LEAF_INVALID"); return 0;
  }
  return 1;
}
int wmain(int argc,WCHAR **argv){
  WCHAR full[512];
  HANDLE h=INVALID_HANDLE_VALUE;
  FILE_ID_INFO info;
  c996_source_only_native_id native;
  c996_source_only_native_id rejected;
  if(argc!=2||!c996_is_isolated_pc()||
     !c996_check_temp_path(argv[1],full)){
    puts("C996_NATIVE_ID_TEMP_STOP:HOST_OR_PATH_UNAUTHORIZED");
    return 2;
  }
  h=CreateFileW(full,FILE_READ_ATTRIBUTES,
    FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE,NULL,OPEN_EXISTING,
    FILE_FLAG_BACKUP_SEMANTICS|FILE_FLAG_OPEN_REPARSE_POINT,NULL);
  if(h==INVALID_HANDLE_VALUE){
    puts("C996_NATIVE_ID_TEMP_STOP:OPEN_FAILED");
    return 3;
  }
  ZeroMemory(&info,sizeof(info));
  if(!GetFileInformationByHandleEx(h,FileIdInfo,&info,(DWORD)sizeof(info))){
    CloseHandle(h);
    puts("C996_NATIVE_ID_TEMP_STOP:FILE_ID_INFO_FAILED");
    return 4;
  }
  CloseHandle(h);
  ZeroMemory(&native,sizeof(native));
  ZeroMemory(&rejected,sizeof(rejected));
  if(!c996_read_fixed_directory(full,info.VolumeSerialNumber,&native)||
     c996_read_fixed_directory(full,info.VolumeSerialNumber ^ 1u,&rejected)){
    puts("C996_NATIVE_ID_TEMP_STOP:SERIAL_OR_REPARSE_GUARD_FAILED");
    return 5;
  }
  printf("C996_NATIVE_ID_TEMP_PASS:%s:%s\n",
         native.volumeSerial,native.fileId128);
  return 0;
}
