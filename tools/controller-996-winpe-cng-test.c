/*
 * #996 WinPE x64 TEST ONLY. Memory-resident public fixtures, no operator.
 * The registry marker identifies an environment, never boot integrity.
 * No volume enumeration, path probes, file writes, Owner keys or recovery.
 */
#ifndef C996_WINPE_CNG_TEST_ONLY
#error C996_WINPE_CNG_TEST_ONLY_REQUIRED
#endif
#ifndef _WIN64
#error C996_WINPE_CNG_REQUIRES_X64
#endif
#if defined(C996_ENABLE_C_GRADE_OPERATOR)
#error C996_WINPE_CNG_NOT_AN_OPERATOR
#endif
#include <windows.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include "controller-996-winpe-cng-handoff-verify.c"
#include "../tests/c996_winpe_cng_public_vectors.h"
#pragma comment(lib, "advapi32.lib")

/* KEY_QUERY_VALUE only: no key creation, value writes, or registry traversal.
 * Missing marker, access denied and all other errors fail closed.
 * Even a present marker can be forged; it is not a trust anchor.
 */
static LSTATUS c996_identify_winpe(void) {
  HKEY key = NULL;
  LSTATUS status = RegOpenKeyExW(HKEY_LOCAL_MACHINE,
    L"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\WinPE",
    0, KEY_QUERY_VALUE | KEY_WOW64_64KEY, &key);
  if (status != ERROR_SUCCESS) return status;
  return RegCloseKey(key);
}
static int c996_crypto_only(c996_cng_crypto_review r, int expected) {
  return r.signatureCryptographicallyVerified == expected &&
    r.trustedOwnerKeyEstablished == 0 && r.ownerApprovalVerified == 0 &&
    r.offlineClockTrusted == 0 && r.winpeRuntimeVerified == 0 &&
    r.executionAuthorized == 0 && r.operationalWrites == 0;
}
static c996_cng_crypto_review c996_check(
  const uint8_t *manifest, const uint8_t *pin,
  const uint8_t *signature, uint32_t length) {
  return c996_source_only_verify_pss_sha256(
    manifest, (uint32_t)sizeof(c996_manifest),
    c996_public_blob, (uint32_t)sizeof(c996_public_blob), pin,
    signature, length);
}
int main(void) {
  uint8_t changedManifest[sizeof(c996_manifest)];
  uint8_t changedSignature[sizeof(c996_signature)];
  uint8_t changedPin[sizeof(c996_public_blob_sha256)];
  LSTATUS environmentStatus = c996_identify_winpe();
  if (environmentStatus != ERROR_SUCCESS) {
    printf("STOP:C996_WINPE_MARKER_UNAVAILABLE registryStatus=%ld\n",
      (long)environmentStatus);
    return 2;
  }
  if (!c996_crypto_only(c996_check(c996_manifest,c996_public_blob_sha256,
      c996_signature,(uint32_t)sizeof(c996_signature)),1)) {
    puts("STOP:C996_WINPE_VALID_PSS_SALT32_FAILED"); return 3;
  }
  memcpy(changedManifest,c996_manifest,sizeof(changedManifest));
  changedManifest[0] ^= 1;
  if (!c996_crypto_only(c996_check(changedManifest,c996_public_blob_sha256,
      c996_signature,(uint32_t)sizeof(c996_signature)),0)) {
    puts("STOP:C996_WINPE_MANIFEST_TAMPER_ACCEPTED"); return 4;
  }
  memcpy(changedSignature,c996_signature,sizeof(changedSignature));
  changedSignature[0] ^= 1;
  if (!c996_crypto_only(c996_check(c996_manifest,c996_public_blob_sha256,
      changedSignature,(uint32_t)sizeof(changedSignature)),0)) {
    puts("STOP:C996_WINPE_SIGNATURE_TAMPER_ACCEPTED"); return 5;
  }
  memcpy(changedPin,c996_public_blob_sha256,sizeof(changedPin));
  changedPin[0] ^= 1;
  if (!c996_crypto_only(c996_check(c996_manifest,changedPin,
      c996_signature,(uint32_t)sizeof(c996_signature)),0)) {
    puts("STOP:C996_WINPE_PUBLIC_PIN_TAMPER_ACCEPTED"); return 6;
  }
  if (!c996_crypto_only(c996_check(c996_manifest,c996_public_blob_sha256,
      c996_wrong_salt_signature,
      (uint32_t)sizeof(c996_wrong_salt_signature)),0)) {
    puts("STOP:C996_WINPE_WRONG_SALT_ACCEPTED"); return 7;
  }
  if (!c996_crypto_only(c996_check(c996_manifest,c996_public_blob_sha256,
      c996_pkcs1_signature,(uint32_t)sizeof(c996_pkcs1_signature)),0)) {
    puts("STOP:C996_WINPE_WRONG_PADDING_ACCEPTED"); return 8;
  }
  puts("C996_WINPE_CNG_TEST_ONLY_6_OF_6_NOT_OWNER_OR_BOOT_INTEGRITY_PROOF");
  puts("environmentMarkerObserved=1 bootIntegrityProven=0 imageBindingVerified=0");
  puts("ownerApprovalVerified=0 offlineClockTrusted=0 revocationVerified=0");
  puts("executionAuthorized=0 operationalWrites=0");
  return 0;
}
