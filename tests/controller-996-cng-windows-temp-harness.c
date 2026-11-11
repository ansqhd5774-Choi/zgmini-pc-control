/* #996 one-shot test vectors only. NO production entry point. */
#ifndef C996_CNG_WINDOWS_TEMP_TEST_ONLY
#error C996_CNG_WINDOWS_TEMP_TEST_ONLY_REQUIRED
#endif
#ifndef _WIN64
#error C996_CNG_WINDOWS_TEST_REQUIRES_X64
#endif
#include <windows.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <wchar.h>
#include "../tools/controller-996-winpe-cng-handoff-verify.c"
#include "c996_cng_test_vectors.h" /* Generated public test fixture; NO private key. */

static int c996_queue_pc_only(void){
  WCHAR name[64];
  DWORD size=(DWORD)(sizeof(name)/sizeof(name[0]));
  DWORD attrs;
  if(!GetComputerNameW(name,&size)||wcscmp(name,L"DESKTOP-N62L0NG")!=0)
    return 0;
  attrs=GetFileAttributesW(L"E:\\ZGmini");
  if(attrs!=INVALID_FILE_ATTRIBUTES)return 0;
  /* Fail closed on access denied, unknown I/O, or a path visibility error. */
  return GetLastError()==ERROR_FILE_NOT_FOUND ||
    GetLastError()==ERROR_PATH_NOT_FOUND ||
    GetLastError()==ERROR_INVALID_DRIVE;
}
static int c996_valid_crypto_only(c996_cng_crypto_review r){
  return r.signatureCryptographicallyVerified==1 &&
    r.trustedOwnerKeyEstablished==0 && r.ownerApprovalVerified==0 &&
    r.offlineClockTrusted==0 && r.winpeRuntimeVerified==0 &&
    r.executionAuthorized==0 && r.operationalWrites==0;
}
static int c996_blocked_crypto_only(c996_cng_crypto_review r){
  return r.signatureCryptographicallyVerified==0 &&
    r.trustedOwnerKeyEstablished==0 && r.ownerApprovalVerified==0 &&
    r.offlineClockTrusted==0 && r.winpeRuntimeVerified==0 &&
    r.executionAuthorized==0 && r.operationalWrites==0;
}
static c996_cng_crypto_review c996_check(
  const uint8_t *manifest,const uint8_t *blob,const uint8_t *blobPin,
  const uint8_t *signature,uint32_t signatureLength){
  return c996_source_only_verify_pss_sha256(
    manifest,(uint32_t)sizeof(c996_manifest),
    blob,(uint32_t)sizeof(c996_public_blob),blobPin,
    signature,signatureLength);
}
int main(void){
  uint8_t changedManifest[sizeof(c996_manifest)];
  uint8_t changedSignature[sizeof(c996_signature)];
  uint8_t changedBlobPin[sizeof(c996_public_blob_sha256)];
  if(!c996_queue_pc_only()){
    puts("STOP:C996_CNG_QUEUE_PC_OR_E_DRIVE_GUARD");
    return 2;
  }
  if(!c996_valid_crypto_only(c996_check(c996_manifest,c996_public_blob,
      c996_public_blob_sha256,c996_signature,
      (uint32_t)sizeof(c996_signature)))){
    puts("STOP:C996_CNG_VALID_SIGNATURE_FAILED");return 3;
  }
  memcpy(changedManifest,c996_manifest,sizeof(changedManifest));
  changedManifest[0]^=1;
  if(!c996_blocked_crypto_only(c996_check(changedManifest,c996_public_blob,
      c996_public_blob_sha256,c996_signature,
      (uint32_t)sizeof(c996_signature)))){
    puts("STOP:C996_CNG_MANIFEST_TAMPER_ACCEPTED");return 4;
  }
  memcpy(changedSignature,c996_signature,sizeof(changedSignature));
  changedSignature[0]^=1;
  if(!c996_blocked_crypto_only(c996_check(c996_manifest,c996_public_blob,
      c996_public_blob_sha256,changedSignature,
      (uint32_t)sizeof(changedSignature)))){
    puts("STOP:C996_CNG_SIGNATURE_TAMPER_ACCEPTED");return 5;
  }
  memcpy(changedBlobPin,c996_public_blob_sha256,sizeof(changedBlobPin));
  changedBlobPin[0]^=1;
  if(!c996_blocked_crypto_only(c996_check(c996_manifest,c996_public_blob,
      changedBlobPin,c996_signature,(uint32_t)sizeof(c996_signature)))){
    puts("STOP:C996_CNG_PUBLIC_KEY_PIN_TAMPER_ACCEPTED");return 6;
  }
  if(!c996_blocked_crypto_only(c996_check(c996_manifest,c996_public_blob,
      c996_public_blob_sha256,c996_wrong_salt_signature,
      (uint32_t)sizeof(c996_wrong_salt_signature)))){
    puts("STOP:C996_CNG_WRONG_SALT_ACCEPTED");return 7;
  }
  if(!c996_blocked_crypto_only(c996_check(c996_manifest,c996_public_blob,
      c996_public_blob_sha256,c996_pkcs1_signature,
      (uint32_t)sizeof(c996_pkcs1_signature)))){
    puts("STOP:C996_CNG_WRONG_PADDING_ACCEPTED");return 8;
  }
  puts("C996_CNG_WINDOWS_TEMP_CRYPTO_PASS_NOT_OWNER_OR_WINPE_PROOF");
  return 0;
}
